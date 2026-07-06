# Task Type Icon Design

## Purpose

Make the five depth-derived planning levels immediately recognizable in the
tree while preserving the existing Jira-compatible hierarchy and local-first
data model.

## Visual Contract

Each task row renders one decorative vendored Lucide SVG before its title. The
existing `depth` value is the sole source of truth for the icon and color:

| Depth | Derived type | Icon | Color treatment |
| --- | --- | --- | --- |
| 1 | Initiative | `Lightbulb` | Jira-like purple |
| 2 | Epic | `Zap` | Jira-like purple |
| 3 | Story | `Bookmark` | Jira-like green |
| 4 | Task | `Check` | Jira-like blue |
| 5 | Subtask | `Check` | Lighter blue than Task |

The icon uses a consistent compact size and flex-basis so titles align across
all levels. CSS owns the color and spacing rather than hard-coding presentation
in the task data or reducer.

## Component and Asset Design

Vendor the four official Lucide SVG path definitions locally, with a source and
license note in the asset module. Do not add a runtime icon package or a CDN
request. Render the trusted local path data through a focused
`TaskTypeIcon` component so CSS `currentColor` controls the Jira-like palette;
Task and Subtask share the `Check` path while receiving different classes.

`TreeRow` passes its existing `depth` prop to `TaskTypeIcon` and does not
duplicate type-selection logic. The vendored definitions are static application
assets, not user-provided markup, and are rendered as ordinary SVG children.

## Accessibility and Interaction

The SVG is `aria-hidden="true"` and is not focusable. The row keeps its current
accessible name, `aria-level`, selection behavior, keyboard navigation, inline
editing, drag handle, dependency indicators, and focus restoration unchanged.
No task-file format, reducer action, import/export behavior, or persisted data
changes are required.

## Verification

Component tests cover all five depth mappings, icon class/color selection, and
decorative accessibility. Existing TreeGrid tests remain the regression suite
for row navigation, editing, dependencies, and drag-and-drop. The normal
format, lint, strict typecheck, coverage, and production-build gates must pass
with no new dependency or network request.
