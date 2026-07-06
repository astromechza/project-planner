# Story Points Design

## Purpose

Let each planning item carry an optional estimation value and make the total
effort of any subtree visible directly in the planning tree.

## Data Contract

Add an optional `storyPoints` field to `PlanTask` with the exact allowed values
`1`, `3`, `5`, `7`, and `14`. `undefined` means unassigned. Existing
`project-planner/v1` files without the field remain valid; import accepts only
the allowed values or an absent field, and export preserves assigned values.
Selecting `None` in the inspector clears the field.

## Calculation and Display

Add a pure domain helper that sums a task's own story points and all descendants.
The helper uses cycle protection consistent with the existing tree utilities.
`TreeRow` receives the project so it can display the aggregate without storing
denormalized totals. Render a compact neutral story-points bubble at the end of
the row when the aggregate is greater than zero; the bubble text is the total,
and its accessible label is `N story points`.

## Inspector Interaction

Add a labelled `Story points` select beside the existing Title and Notes fields.
Options are `None`, `1`, `3`, `5`, `7`, and `14`. Changing the select dispatches
the existing task-update pathway, so recovery storage and export observe the
same persisted project state.

## Accessibility and Compatibility

The story-points bubble is non-interactive and never receives focus. It exposes
`role="img"` with an accessible total while remaining visually compact. The
existing task-type, notes, dependency, keyboard, drag-and-drop, and focus
behaviors remain unchanged. No project format version bump is required.

## Verification

Tests cover allowed-value validation, backward-compatible parsing and
round-trip serialization, direct and nested totals, clearing a value, inspector
updates, and row display. The normal format, lint, strict typecheck, coverage,
and production-build gates must pass.
