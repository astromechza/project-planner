# Sibling Reordering Keyboard Shortcuts

## Goal

Allow a focused task row to move one position within its existing sibling list using keyboard shortcuts:

- `Shift+Arrow Up`: move the task one position earlier
- `Shift+Arrow Down`: move the task one position later

The shortcuts must not change the task's parent or affect descendants.

## Behavior

`TreeGrid` handles the shortcuts when the task row itself has focus. Root tasks are reordered in `project.rootTaskIds`; nested tasks are reordered in their parent task's `childIds`.

The handler resolves the current sibling index and calls the existing `onMove` callback with a same-parent destination. `moveTask` remains the domain-level authority for validating and applying the reorder, keeping keyboard movement consistent with drag-and-drop and other structural operations.

When the task has no sibling, is already first, or is already last, the shortcut is a no-op. The event is not consumed in those cases, so normal unmodified arrow-key behavior remains available. Title-edit inputs and drag handles retain their current event isolation.

## User interface

The keyboard-shortcuts dialog adds two entries to “Edit structure”:

- `Shift` + `Arrow Up` — Move a task up within its siblings
- `Shift` + `Arrow Down` — Move a task down within its siblings

No new controls or visual indicators are required.

## Testing

Tests will verify:

- moving a root task up and down changes `rootTaskIds` in the expected order;
- moving a nested task changes only its parent’s `childIds`;
- first/last/single-child boundary cases do not reorder tasks;
- the selected task remains focused after a successful reorder;
- plain arrow keys retain existing navigation behavior;
- the shortcuts are present in the documented shortcut groups and rendered dialog.

