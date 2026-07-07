# Export JSON Schema — Design

Date: 2026-07-07
Issue: [#5](https://github.com/astromechza/project-planner/issues/5)

## Problem

To help AI agents (and other tools) consume, edit, and validate the exported
project file, we want to publish a JSON Schema document at a stable, well-known
URL and reference it from the export via a top-level `$schema` key. The
reference must use the hostname of the site the file was exported from, so a
fork or self-host emits its own URL automatically.

## Decisions

- **Schema source:** hand-written static JSON Schema file, kept honest by a
  drift test (not generated from types).
- **URL derivation:** computed at runtime from `window.location.origin` +
  `import.meta.env.BASE_URL`, so the emitted URL matches wherever the app is
  served.
- **Path:** a single unversioned file at the site root under the base path.
  Full production URL:
  `https://astromechza.github.io/project-planner/project-planner.schema.json`.
- **Versioning:** intentionally **not** encoded in the URL. The in-file
  `format: "project-planner/v1"` field remains the sole version signal. (The
  issue's "basic major versioning" ask was explicitly dropped for this pass; a
  future breaking change can introduce a versioned filename then.)
- **Field docs:** every schema property carries a `description`, including the
  integrity constraints JSON Schema cannot express, so agents reading the
  schema still learn them.

## Architecture

### 1. Schema URL helper — `src/infrastructure/schemaUrl.ts`

```ts
export const projectSchemaUrl = (): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}project-planner.schema.json`;
```

- `BASE_URL` is `/project-planner/` in prod and dev (Vite `base`), always ends
  in `/`, so concatenation with the filename is correct.
- Kept out of `serializeProjectFile` so that serializer stays pure and
  deterministically testable.

### 2. Serializer — `src/infrastructure/projectFile.ts`

`serializeProjectFile(project, schemaUrl)` gains a required `schemaUrl: string`
parameter and writes `$schema` as the **first** key (object insertion order is
preserved by `JSON.stringify`):

```json
{
  "$schema": "https://astromechza.github.io/project-planner/project-planner.schema.json",
  "format": "project-planner/v1",
  "name": "...",
  "rootTaskIds": [...],
  "tasks": {...},
  "dependencies": [...]
}
```

The domain `Project` type is **unchanged** — `$schema` is a serialization
concern and is not stored in memory.

### 3. Import — `parseProjectFile` (no behavior change)

`parseProjectFile` already ignores unknown top-level keys, so an imported
`$schema` is passed over and not stored. On re-export it is re-derived from the
current origin. Round-trips cleanly. One test is added to assert import ignores
`$schema`.

### 4. Caller — `src/components/AppToolbar.tsx`

`handleExport` computes `projectSchemaUrl()` and passes it to
`serializeProjectFile`.

### 5. Schema document — `public/project-planner.schema.json`

- JSON Schema **draft 2020-12**.
- Vite copies `public/` to the dist root under the base path, so the file is
  served at the stable URL above.
- Structural coverage (root, with `additionalProperties: false`):
  - `$schema` (string) — the schema URL.
  - `format` (const `"project-planner/v1"`).
  - `name` (string).
  - `rootTaskIds` (array of unique strings).
  - `tasks` (object; values are task objects).
  - `dependencies` (array of `{ blockerId, blockedId }`).
- Task object: `id`, `title`, `parentId` (string | null), `childIds` (string
  array), optional `notes` (string), optional `storyPoints`
  (enum `[1, 3, 5, 7, 14]`).
- **Every property has a `description`.** Descriptions of the relevant fields
  document the semantic constraints that plain JSON Schema cannot enforce:
  - parent/child back-reference integrity (`parentId` ↔ parent's `childIds`),
  - root tasks have `parentId: null` and appear in `rootTaskIds`,
  - dependency endpoints must reference existing tasks; no self-dependency; no
    duplicate `(blockerId, blockedId)` pairs,
  - hierarchy depth is capped at 5 levels,
  - task ids are unique and must not be `__proto__`, `prototype`, or
    `constructor`.
- The schema is a **shape + documentation contract** for external consumers.
  `parseProjectFile` remains the authority for full semantic validation.

## Drift test

New test (using `ajv` + `ajv-formats` as dev dependencies):

- Compile `public/project-planner.schema.json`.
- Validate the existing example export object(s) from the current tests →
  assert **valid**.
- Validate malformed variants (bad `storyPoints`, missing `title`, unknown root
  key) → assert **invalid**.

This catches the hand-written schema drifting from what the app actually emits
and accepts.

## Testing summary

- `schemaUrl` unit test: asserts URL composition (mock `window.location` /
  `BASE_URL`).
- `serializeProjectFile` test: updated to pass a fixed URL and assert `$schema`
  is present and first.
- `parseProjectFile` test: asserts an imported `$schema` key is ignored and
  round-trips.
- Schema drift test: valid/invalid fixtures against the compiled schema.

## Out of scope

- Generating the schema from TypeScript types.
- Versioned schema URLs / multiple schema files.
- Encoding semantic constraints as JSON Schema keywords beyond structural shape.
