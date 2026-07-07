# Export JSON Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a hand-written JSON Schema at a stable URL and reference it from the exported file via a runtime-derived top-level `$schema` key.

**Architecture:** A tiny helper derives the schema URL from `window.location.origin` + Vite's `BASE_URL` at export time. `serializeProjectFile` takes that URL and writes `$schema` as the first key. `parseProjectFile` already ignores unknown keys, so imports round-trip untouched. A static schema file lives in `public/` (served at the stable path) and is kept honest by an Ajv drift test.

**Tech Stack:** TypeScript, React, Vite, Vitest, Ajv (JSON Schema draft 2020-12).

---

## Context for the implementer

- Export today: `serializeProjectFile(project)` in `src/infrastructure/projectFile.ts:265` hand-picks fields; `handleExport` in `src/components/AppToolbar.tsx:89` downloads it as `project-plan.json`.
- `parseProjectFile` (`src/infrastructure/projectFile.ts:220`) only reads known keys and ignores extras — so an incoming `$schema` needs no special handling.
- The domain `Project` type (`src/domain/types.ts:26`) stays unchanged; `$schema` is a serialization-only concern.
- Vite `base` is `/project-planner/` (see `vite.config.ts`), so `import.meta.env.BASE_URL` is `/project-planner/` (always trailing slash). Files in `public/` are copied to the dist root under that base.
- Tests run under jsdom with `vitest run --coverage`; `src/infrastructure/**` has per-file coverage thresholds of 90%.
- Run a single test file with: `npx vitest run <path>`.

---

## Task 1: Schema URL helper

**Files:**
- Create: `src/infrastructure/schemaUrl.ts`
- Test: `src/infrastructure/schemaUrl.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/infrastructure/schemaUrl.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectSchemaUrl } from './schemaUrl';

describe('projectSchemaUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('joins the current origin, base path, and schema filename', () => {
    vi.stubGlobal('location', { origin: 'https://plans.example' });

    expect(projectSchemaUrl()).toBe(
      `https://plans.example${import.meta.env.BASE_URL}project-planner.schema.json`,
    );
  });

  it('produces no double slash between base and filename', () => {
    vi.stubGlobal('location', { origin: 'https://plans.example' });

    expect(projectSchemaUrl()).not.toMatch(/[^:]\/\/project-planner\.schema/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/infrastructure/schemaUrl.test.ts`
Expected: FAIL — cannot resolve `./schemaUrl`.

- [ ] **Step 3: Write minimal implementation**

Create `src/infrastructure/schemaUrl.ts`:

```ts
/**
 * URL of the published JSON Schema for the export file, derived from wherever
 * the app is currently served so forks and self-hosts emit their own address.
 * `BASE_URL` always ends in a slash, so the filename is appended directly.
 */
export const projectSchemaUrl = (): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}project-planner.schema.json`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/infrastructure/schemaUrl.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/schemaUrl.ts src/infrastructure/schemaUrl.test.ts
git commit -m "feat: add project schema URL helper"
```

---

## Task 2: Emit `$schema` from the serializer

**Files:**
- Modify: `src/infrastructure/projectFile.ts:265-276` (add `schemaUrl` param, write `$schema` first)
- Modify: `src/infrastructure/projectFile.test.ts` (update call sites, deterministic-order expectation, add import-ignores-`$schema` test)
- Modify: `src/components/AppToolbar.tsx:89-101` (pass `projectSchemaUrl()`)

- [ ] **Step 1: Update the serializer signature and output**

In `src/infrastructure/projectFile.ts`, replace `serializeProjectFile` (lines 265-276) with:

```ts
export const serializeProjectFile = (
  project: Project,
  schemaUrl: string,
): string =>
  JSON.stringify(
    {
      $schema: schemaUrl,
      format: project.format,
      name: project.name,
      rootTaskIds: project.rootTaskIds,
      tasks: project.tasks,
      dependencies: project.dependencies,
    },
    null,
    2,
  );
```

- [ ] **Step 2: Update the test file's serializer call sites and expectations**

In `src/infrastructure/projectFile.test.ts`:

Add a shared constant just after the `project` definition (after line 28):

```ts
const schemaUrl = 'https://plans.example/project-planner.schema.json';
```

Replace the round-trip test (lines 31-35) with:

```ts
  it('round-trips a valid project and ignores the schema hint', () => {
    const serialized = serializeProjectFile(project, schemaUrl);

    expect(parseProjectFile(serialized)).toEqual({ ok: true, value: project });
  });
```

Replace the deterministic-order test (lines 37-68) with:

```ts
  it('serializes projects deterministically with $schema first', () => {
    expect(serializeProjectFile(project, schemaUrl)).toBe(`{
  "$schema": "https://plans.example/project-planner.schema.json",
  "format": "project-planner/v1",
  "name": "Health Hub plan",
  "rootTaskIds": [
    "initiative-1"
  ],
  "tasks": {
    "initiative-1": {
      "id": "initiative-1",
      "title": "Deliver Health Hub",
      "parentId": null,
      "childIds": [
        "epic-1"
      ]
    },
    "epic-1": {
      "id": "epic-1",
      "title": "Build the baseline",
      "parentId": "initiative-1",
      "childIds": [],
      "notes": "Start with the parent POM."
    }
  },
  "dependencies": [
    {
      "blockerId": "initiative-1",
      "blockedId": "epic-1"
    }
  ]
}`);
  });
```

In the story-points round-trip test (lines 153 and 157), add the `schemaUrl` argument to both `serializeProjectFile(...)` calls:

```ts
    expect(
      parseProjectFile(serializeProjectFile(projectWithPoints, schemaUrl)),
    ).toEqual({
      ok: true,
      value: projectWithPoints,
    });
    expect(parseProjectFile(serializeProjectFile(project, schemaUrl))).toEqual({
      ok: true,
      value: project,
    });
```

- [ ] **Step 3: Add an explicit import-ignores-`$schema` test**

Add this test inside the `describe('project files', ...)` block in `src/infrastructure/projectFile.test.ts`:

```ts
  it('ignores a $schema key on import', () => {
    const withSchema = JSON.stringify({
      $schema: 'https://elsewhere.example/some.schema.json',
      ...project,
    });

    const result = parseProjectFile(withSchema);

    expect(result).toEqual({ ok: true, value: project });
    if (result.ok) {
      expect('$schema' in result.value).toBe(false);
    }
  });
```

- [ ] **Step 4: Update the export caller**

In `src/components/AppToolbar.tsx`, add to the existing import block from `../infrastructure/projectFile` a sibling import (top of file):

```ts
import { projectSchemaUrl } from '../infrastructure/schemaUrl';
```

Replace the first line of `handleExport` (line 90) so the blob uses the schema URL:

```ts
  const handleExport = (): void => {
    const file = new Blob([serializeProjectFile(project, projectSchemaUrl())], {
      type: 'application/json',
    });
```

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run src/infrastructure/projectFile.test.ts`
Expected: PASS — all project-file tests green, including the new `$schema` cases.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/projectFile.ts src/infrastructure/projectFile.test.ts src/components/AppToolbar.tsx
git commit -m "feat: reference published JSON schema from exported files"
```

---

## Task 3: Publish the schema document with a drift test

**Files:**
- Create: `public/project-planner.schema.json`
- Create: `src/infrastructure/projectSchema.test.ts`
- Modify: `package.json` (declare `ajv` dev dependency)

- [ ] **Step 1: Declare the Ajv dev dependency**

Run: `npm install -D ajv`
Expected: `ajv` appears under `devDependencies` in `package.json`; lockfile updates.

- [ ] **Step 2: Write the failing drift test**

Create `src/infrastructure/projectSchema.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { serializeProjectFile } from './projectFile';
import type { Project, TaskId } from '../domain/types';

const schemaPath = fileURLToPath(
  new URL('../../public/project-planner.schema.json', import.meta.url),
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const validate = new Ajv2020().compile(schema);

const initiativeId = 'initiative-1' as TaskId;
const epicId = 'epic-1' as TaskId;

const project: Project = {
  format: 'project-planner/v1',
  name: 'Health Hub plan',
  rootTaskIds: [initiativeId],
  tasks: {
    [initiativeId]: {
      id: initiativeId,
      title: 'Deliver Health Hub',
      parentId: null,
      childIds: [epicId],
    },
    [epicId]: {
      id: epicId,
      title: 'Build the baseline',
      parentId: initiativeId,
      childIds: [],
      notes: 'Start with the parent POM.',
      storyPoints: 5,
    },
  },
  dependencies: [{ blockerId: initiativeId, blockedId: epicId }],
};

const exported = (): unknown =>
  JSON.parse(
    serializeProjectFile(project, 'https://plans.example/project-planner.schema.json'),
  );

describe('project-planner.schema.json', () => {
  it('accepts a real export produced by the serializer', () => {
    expect(validate(exported())).toBe(true);
  });

  it('rejects an unknown top-level key', () => {
    expect(validate({ ...(exported() as object), surprise: true })).toBe(false);
  });

  it('rejects an invalid story point value', () => {
    const bad = exported() as { tasks: Record<string, { storyPoints?: number }> };
    bad.tasks['epic-1'].storyPoints = 2;

    expect(validate(bad)).toBe(false);
  });

  it('rejects a task missing its title', () => {
    const bad = exported() as { tasks: Record<string, { title?: string }> };
    delete bad.tasks['epic-1'].title;

    expect(validate(bad)).toBe(false);
  });

  it('rejects a wrong format constant', () => {
    expect(validate({ ...(exported() as object), format: 'project-planner/v2' })).toBe(
      false,
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/infrastructure/projectSchema.test.ts`
Expected: FAIL — cannot read `public/project-planner.schema.json` (file does not exist yet).

- [ ] **Step 4: Write the schema document**

Create `public/project-planner.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://astromechza.github.io/project-planner/project-planner.schema.json",
  "title": "Project Planner export file",
  "description": "A project-planner/v1 plan: a forest of hierarchical tasks plus blocking dependencies between them. This schema validates structural shape; the application's parser enforces the additional integrity rules called out in each description.",
  "type": "object",
  "additionalProperties": false,
  "required": ["format", "name", "rootTaskIds", "tasks", "dependencies"],
  "properties": {
    "$schema": {
      "type": "string",
      "description": "URL of this schema document. Emitted as the first key so tools and AI agents can discover the contract; it points at the schema hosted by the site the file was exported from."
    },
    "format": {
      "const": "project-planner/v1",
      "description": "Format identifier and version tag. Must be exactly \"project-planner/v1\"; any other value is an unsupported format and must be rejected."
    },
    "name": {
      "type": "string",
      "description": "Human-readable plan name."
    },
    "rootTaskIds": {
      "type": "array",
      "description": "Ordered ids of the top-level tasks. Every id must exist in `tasks` and reference a task whose parentId is null. Conversely, every task with parentId null must appear here exactly once. Ids are unique within this array.",
      "items": { "type": "string" },
      "uniqueItems": true
    },
    "tasks": {
      "type": "object",
      "description": "Map of task id to task. Each entry's key must equal the task's `id`, and keys must not be \"__proto__\", \"prototype\", or \"constructor\". The parent/child hierarchy formed by parentId and childIds must be internally consistent, acyclic, and no deeper than 5 levels (Initiative > Epic > Story > Task > Subtask).",
      "additionalProperties": { "$ref": "#/$defs/task" }
    },
    "dependencies": {
      "type": "array",
      "description": "Blocking edges between tasks. For each edge, blockerId and blockedId must reference existing tasks, must differ (no self-dependency), and the same (blockerId, blockedId) pair must not appear more than once.",
      "items": { "$ref": "#/$defs/dependency" }
    }
  },
  "$defs": {
    "task": {
      "type": "object",
      "additionalProperties": false,
      "required": ["id", "title", "parentId", "childIds"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique task id. Must equal the key under which this task is stored in `tasks`, and must not be \"__proto__\", \"prototype\", or \"constructor\"."
        },
        "title": {
          "type": "string",
          "description": "Human-readable task title."
        },
        "parentId": {
          "type": ["string", "null"],
          "description": "Id of the parent task, or null for a root task. When non-null it must reference an existing task whose `childIds` includes this task's id; when null this task's id must appear in the top-level `rootTaskIds`."
        },
        "childIds": {
          "type": "array",
          "description": "Ordered ids of this task's direct children. Every referenced task must exist and have its `parentId` set to this task's id. Ids are unique within this array.",
          "items": { "type": "string" },
          "uniqueItems": true
        },
        "notes": {
          "type": "string",
          "description": "Optional free-form notes for the task."
        },
        "storyPoints": {
          "enum": [1, 3, 5, 7, 14],
          "description": "Optional effort estimate. When present it must be one of the allowed values: 1, 3, 5, 7, or 14."
        }
      }
    },
    "dependency": {
      "type": "object",
      "additionalProperties": false,
      "required": ["blockerId", "blockedId"],
      "properties": {
        "blockerId": {
          "type": "string",
          "description": "Id of the task that must be completed first. Must reference an existing task and differ from blockedId."
        },
        "blockedId": {
          "type": "string",
          "description": "Id of the task that is blocked until the blocker is done. Must reference an existing task and differ from blockerId."
        }
      }
    }
  }
}
```

- [ ] **Step 5: Run the drift test to verify it passes**

Run: `npx vitest run src/infrastructure/projectSchema.test.ts`
Expected: PASS — all five cases green.

- [ ] **Step 6: Commit**

```bash
git add public/project-planner.schema.json src/infrastructure/projectSchema.test.ts package.json package-lock.json
git commit -m "feat: publish JSON schema for the export file"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 2: Full test suite with coverage**

Run: `npm test`
Expected: all tests pass; `src/infrastructure/**` per-file coverage stays ≥ 90% (the new `schemaUrl.ts` is exercised by its test).

- [ ] **Step 3: Production build (confirms schema is published and types compile)**

Run: `npm run build`
Expected: build succeeds; `dist/project-planner.schema.json` exists.

Verify the published file:

Run: `test -f dist/project-planner.schema.json && echo OK`
Expected: `OK`.

- [ ] **Step 4: Manual sanity check of an export (optional but recommended)**

Confirm that an exported file begins with the `$schema` key pointing at
`<origin>/project-planner/project-planner.schema.json`. This is covered by the
deterministic serializer test, so no code change is needed — just awareness.

- [ ] **Step 5: No commit needed** (verification only). If lint/build produced incidental fixes, commit them with `chore:`.

---

## Notes / decisions carried from the spec

- `$schema` is **not** stored in the domain `Project` type — it is added only at serialization and ignored on import.
- The schema documents semantic constraints (back-references, dependency validity, depth ≤ 5, reserved ids) in prose `description`s; JSON Schema cannot enforce them and `parseProjectFile` remains the authority.
- Versioning is intentionally not in the URL; `format: "project-planner/v1"` is the sole version signal (per the approved spec).
