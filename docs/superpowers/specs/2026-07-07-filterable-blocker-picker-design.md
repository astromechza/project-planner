# Filterable blocker picker

Resolves [#8](https://github.com/astromechza/project-planner/issues/8): the
"Blocked by" `<select>` becomes hard to navigate once a project has 30+ tasks,
especially with similarly named items.

## Goal

Let the user filter candidate blockers by typing, then pick one, without
scrolling a long native dropdown.

## Approach

Replace the native `<select>` in `DependencyControl`
(`src/components/DependencyEditor.tsx`) with a text `<input>` bound to a native
`<datalist>`. The browser provides type-ahead filtering for free; no new
dependencies, no custom popup/keyboard handling.

### Markup

- `<input>`:
  - `list="blocker-options-<selectedTaskId>"`
  - `aria-label="Blocked by"` (unchanged — tests and a11y depend on it)
  - `className="dependency-control-select"` (unchanged — drives grid sizing;
    asserted by a test)
  - `placeholder="Type to filter tasks"`
- `<datalist id="blocker-options-<selectedTaskId>">` with one `<option>` per
  candidate task.
- "Add blocker" button unchanged.

### Duplicate-title handling

A `<datalist>` writes the selected option's `value` (its display text) into the
input, not a task id. Task titles are not unique, so we cannot map text → id
naively.

Build an ordered `Map<string, TaskId>` over the sorted candidates:

- Display text starts as the task title.
- On collision, append ` (2)`, ` (3)`, … so every option value is unique and
  human-readable.

Each `<option value={displayText}>` uses this text. Resolution is a lookup in
the same map.

### State

- `useState<string>('')` for the input text (was `TaskId | ''`).
- The component is already keyed by `selectedTaskId` in `DependencyEditor`, so
  switching the selected task remounts it and clears the input — preserves the
  existing "clears pending relationship on task change" behaviour.

### Add flow

- Button `disabled` when input text is empty OR not present in the map.
- On click: resolve the id from the map, call `onAdd(id)`, clear the input.

### CSS

Reuse `.dependency-control-select` on the input. Add box-sizing/appearance
tweaks under `input.dependency-control-select` only if the native input renders
inconsistently with the previous select; expected to reuse as-is.

## Testing

Unit tests in `src/components/DependencyEditor.test.tsx`:

- Replace `user.selectOptions(...)` with `user.type(...)` into the "Blocked by"
  input, then click "Add blocker"; assert `onLink` called with the correct id.
- Duplicate titles: two candidates with the same title produce option values
  `Title` and `Title (2)`; typing `Title (2)` + Add resolves to the second id.
- Keep existing coverage: excludes self and existing blockers, sorts
  alphanumerically, clears on selected-task change, removes links, cycle warning,
  `dependency-control-select` class present.

### Known limitation

jsdom does not render or filter native `<datalist>` options, so the *filtering*
itself is not exercised at the unit level — only the value → id resolution and
the Add flow. Accepted; no e2e added for this.
