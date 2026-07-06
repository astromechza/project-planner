# Notes Indicator Design

## Purpose

Make task notes discoverable from the planning tree without opening the task
inspector, while preserving the compact Jira-style row layout.

## Visual Contract

When a task's `notes` value contains non-whitespace content, render a local
vendored Lucide `MessageCircle` SVG immediately after the task title and before
the dependency indicator. Use the existing neutral icon treatment rather than
the depth-derived task-type colors. Notes that are absent, empty, or contain
only whitespace render no indicator.

## Component and Data Flow

Add the canonical Lucide `MessageCircle` path data to the existing local icon
data module and render it through a focused `TaskNotesIndicator` component.
`TreeRow` derives `hasNotes` with `task.notes?.trim().length > 0` and renders
the indicator after the title. No reducer, persisted-file, import/export, or
inspector changes are required.

## Accessibility and Interaction

The indicator is non-interactive and never receives focus. It exposes
`role="img"` with `aria-label="Has notes"` so the information is available to
assistive technology; the SVG itself is decorative. Existing row selection,
keyboard navigation, inline editing, drag-and-drop, dependency highlighting,
and focus restoration remain unchanged.

## Verification

Component tests cover populated notes, empty notes, whitespace-only notes,
accessible labeling, and placement after the title. Existing TreeGrid tests
remain the regression suite for row behavior. The normal formatting, lint,
strict typecheck, coverage, and production-build gates must pass without adding
a network dependency.
