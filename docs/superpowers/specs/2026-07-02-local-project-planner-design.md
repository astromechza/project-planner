# Local Project Planner: V1 Design

## Purpose

Build a browser-first, local React project planner optimised for rapid hierarchy
editing. It provides the useful planning interaction of Jira Structures without
being a Jira-backed issue tracker. One workspace represents one project plan.

The planner is personal and local-first. It stores no authentication, user, or
collaboration data. A future Jira export reads the planner model without
altering its tree behaviour.

## Scope

V1 supports:

- A dense, indented tree of planning items.
- Creating children and siblings quickly.
- Keyboard-first navigation and hierarchy editing.
- Drag-and-drop reordering and reparenting.
- Direct blocker dependencies and selection-based highlighting.
- Browser recovery plus import and export of one portable project JSON file.
- Optional notes per item.

V1 excludes dates, status, assignees, collaboration, authentication, Jira
synchronisation, and Jira import.

## Interaction Model

The workspace has a tree grid and a task inspector. Selecting an item marks it
in blue, its direct prerequisites in amber, and the items it directly blocks in
red/orange. A small dependency indicator on a row makes linked items scannable
without opening the inspector.

The inspector edits the selected item's title and notes, provides an explicit
Add child action when valid, and manages `Blocks` and `Blocked by` lists.

Keyboard behaviour:

- Enter creates the next sibling.
- Tab indents the selected item beneath the preceding sibling when that move is
  valid.
- Shift+Tab outdents the selected item.
- Arrow keys move selection and expand or collapse tree rows.

Drag behaviour uses deliberate target zones:

- Dropping in a row's upper or lower zone inserts before or after the target as
  a sibling.
- Dropping in the central child zone reparents beneath the target.
- A drop onto the item itself or one of its descendants is invalid.

## Five-Level Hierarchy

The item type is computed from depth and is never stored independently.

| Depth | Derived type | Valid children |
| --- | --- | --- |
| 1 | Initiative | Epics |
| 2 | Epic | Stories |
| 3 | Story | Tasks |
| 4 | Task | Subtasks |
| 5 | Subtask | None |

Only initiatives may be root items. Creation controls expose only the valid
next depth. A move, indent, or reparent operation is rejected if it would put
the moved item or any of its descendants below depth five. The displayed type
updates immediately after any valid move. Future Jira export maps this derived
type to the configured Jira issue type.

## Data and Persistence

The portable JSON document has a versioned schema (`project-planner/v1`) and
contains metadata, root item IDs, a task map, and dependency edges. A task has
`id`, `title`, `parentId`, `childIds`, and optional `notes`. Child ordering is
held exclusively in `childIds`, allowing a subtree move to be one atomic state
update.

A dependency has `blockerId` and `blockedId` and means the blocked item cannot
start until the blocker is complete. The app rejects self-dependencies and
duplicates. Dependency cycles are permitted in V1 but detected and visibly
flagged; the planner has no workflow-status engine that would enforce them.

Browser storage keeps a recovery copy between explicit saves. Import validates
the selected file before it can replace the current plan. Export produces a
deterministic portable JSON file. A malformed file reports a useful validation
error without changing the open plan.

Deleting an item with children or dependency links requires confirmation. The
confirmed operation deletes its whole subtree and removes all incident
dependency edges.

## Component Boundaries

- `ProjectApp`: coordinates loading, recovery, import/export, and selected
  item state.
- `TreeGrid`: renders visible rows and owns tree keyboard focus/navigation.
- `TreeRow`: presents one item, depth/type, selection and dependency state.
- `DragController`: translates a drop zone into a validated tree operation.
- `TaskInspector`: edits title/notes and manages dependency links.
- `treeOperations`: pure create, move, reparent, indent, outdent and delete
  functions.
- `dependencyOperations`: pure link, unlink, incident-link removal and cycle
  detection functions.
- `projectFile`: schema validation and deterministic import/export conversion.

The pure operation modules are independent of React, storage, and drag/drop
libraries so they can be tested exhaustively.

## Implementation Constraints and Quality Gates

The app uses React, TypeScript, and Vite. It targets the current active Node
LTS release, recorded in `.nvmrc` and `package.json` engines. Package versions
are pinned in `package.json` and the committed lockfile; CI installs them with
`npm ci`.

The UI uses native CSS and CSS custom properties rather than a component
framework. `dnd-kit` is the single interaction dependency for accessible
pointer and keyboard drag-and-drop. Vitest and React Testing Library cover
unit and component behaviour; Playwright covers the critical end-to-end flow.
ESLint, `typescript-eslint`, `eslint-plugin-react-hooks`,
`eslint-plugin-jsx-a11y`, and Prettier provide the developer quality toolchain.

TypeScript uses `strict` plus `exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `noUnusedLocals`, and `noUnusedParameters`.
Code must not use `any` or unchecked type assertions for project-file input.
Import parsing starts from `unknown` and uses an explicit runtime validator
which returns a typed success or a user-facing validation failure. Domain IDs
use branded string types, and operations return discriminated success/failure
results instead of relying on thrown errors for expected invalid moves.

Linting is type-aware through `typescript-eslint` project service and enables
the React Hooks and accessibility rule sets. The UI uses semantic controls,
visible keyboard focus, and WAI-ARIA tree/grid semantics where needed. A
top-level error boundary offers recovery from browser storage or a new file
instead of leaving the planner blank after an unexpected render error.

Required local and CI checks are `lint`, `format:check`, `typecheck`, `test`,
and `build`. Pure tree, dependency, import, and persistence modules carry a
90% line and branch coverage threshold; UI coverage is evaluated by critical
interaction scenarios rather than a blanket percentage. The end-to-end check
creates, moves, reparents, links, exports, reloads, and imports a plan.

## Verification

Unit tests cover tree ordering, moves, reparenting, depth-limit rejection,
tree-cycle prevention, keyboard-derived operations, dependency cleanup and
cycle detection, import validation, and project persistence round-trips. Tests
exercise malformed and incomplete imported data as well as valid files.

Component tests cover selection highlighting, inspector updates, keyboard
commands, invalid-drop feedback, and valid drag/drop behaviours. A small
end-to-end flow covers create, rearrange, link a blocker, export, reload, and
import into a fresh browser state.
