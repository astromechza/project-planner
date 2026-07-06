# Keyboard Shortcut Discovery Design

## Purpose

Make every existing planner keyboard command discoverable without presenting
shortcut hints that imply unsupported actions.

## Interaction

The toolbar has a persistent `Keyboard shortcuts` button that opens an
accessible modal. The modal groups every implemented command:

- Navigate: Arrow Up/Down selects a row; Arrow Right expands/selects a child;
  Arrow Left collapses/selects a parent.
- Edit structure: E starts inline editing of the selected task title and
  selects its text; Shift+Enter creates the next sibling; Enter saves an inline
  title edit; Tab indents; Shift+Tab outdents; Escape cancels title editing.
- Drag and drop: Space picks up a task; Arrow keys choose a drop zone; Enter
  drops; Escape cancels.

The empty tree adds the compact hint `Need shortcuts? Press ?`.

`?` opens the dialog when focus is on a task row or the empty task tree. The
empty tree is keyboard-focusable so its hint is actionable. It must never
intercept ordinary typing in an input or drag-handle interaction.

`E` starts title editing only when a task row itself has focus and no modifier
keys are held. It does nothing from an inline title input, a drag handle, or
the shortcut dialog. Double-clicking a title remains an equivalent pointer
interaction.

## Accessibility and Error Handling

The button exposes `aria-haspopup="dialog"`. The modal is labelled `Keyboard
shortcuts`, keeps focus within itself, restores focus to the opener when
closed, and closes via Escape or a Close button. The displayed shortcuts are a
single shared data definition used by the modal and any contextual hint, so
the UI cannot drift from the actual supported command list.

## Verification

Component tests cover button open/close, `?` from a task row and the empty
tree, input/drag-handle protection, Escape close, focus restoration, and the
text of all shortcut groups. Tree tests prove that E opens and focuses a title
edit only from a task row, plain Enter on a row does not create a sibling while
Shift+Enter does; existing drag tests remain the behavioral source of truth for
the listed commands.
