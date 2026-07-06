import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';

export interface Shortcut {
  readonly keys: readonly string[];
  readonly description: string;
}

export interface ShortcutGroup {
  readonly title: string;
  readonly shortcuts: readonly Shortcut[];
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Arrow Up', 'Arrow Down'], description: 'Select a task' },
      {
        keys: ['Arrow Right'],
        description: 'Expand a task or select its child',
      },
      {
        keys: ['Arrow Left'],
        description: 'Collapse a task or select its parent',
      },
      { keys: ['?'], description: 'Open keyboard shortcuts' },
    ],
  },
  {
    title: 'Edit structure',
    shortcuts: [
      { keys: ['E'], description: 'Edit title' },
      {
        keys: ['Shift', 'Arrow Up'],
        description: 'Move a task up within its siblings',
      },
      {
        keys: ['Shift', 'Arrow Down'],
        description: 'Move a task down within its siblings',
      },
      { keys: ['Shift', 'Enter'], description: 'Create the next sibling' },
      { keys: ['Enter'], description: 'Save title edit' },
      { keys: ['Tab'], description: 'Indent under the preceding sibling' },
      { keys: ['Shift', 'Tab'], description: 'Outdent after the parent' },
      { keys: ['Escape'], description: 'Cancel title edit' },
    ],
  },
  {
    title: 'Drag and drop (task drag handle focused)',
    shortcuts: [
      { keys: ['Space'], description: 'Pick up a task' },
      { keys: ['Arrow keys'], description: 'Choose a drop zone' },
      { keys: ['Enter'], description: 'Drop a task' },
      { keys: ['Escape'], description: 'Cancel dragging' },
    ],
  },
];

interface KeyboardShortcutsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const isInvalidStateError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'InvalidStateError';

export function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch (error) {
          if (!isInvalidStateError(error)) {
            throw error;
          }
        }
      }
      closeButtonRef.current?.focus();
    } else if (dialog.open) {
      try {
        dialog.close();
      } catch (error) {
        if (!isInvalidStateError(error)) {
          throw error;
        }
      }
    }
  }, [open]);

  useEffect(
    () => () => {
      const dialog = dialogRef.current;
      if (dialog?.open) {
        try {
          dialog.close();
        } catch (error) {
          if (!isInvalidStateError(error)) {
            throw error;
          }
        }
      }
    },
    [],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>): void => {
    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ??
        []),
    ];
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (firstElement === undefined || lastElement === undefined) {
      event.preventDefault();
      return;
    }

    if (
      event.shiftKey
        ? document.activeElement === firstElement
        : document.activeElement === lastElement
    ) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
    }
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="shortcut-dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={headingId}
      onKeyDown={handleKeyDown}
      onCancel={handleCancel}
    >
      <div className="shortcut-dialog-header">
        <h2 id={headingId}>Keyboard shortcuts</h2>
        <button ref={closeButtonRef} type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.title} className="shortcut-group">
          <h3>{group.title}</h3>
          <ul>
            {group.shortcuts.map((shortcut) => (
              <li key={`${group.title}-${shortcut.description}`}>
                <span
                  className="shortcut-keycaps"
                  aria-label={shortcut.keys.join(' + ')}
                >
                  {shortcut.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </span>
                <span>{shortcut.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </dialog>
  );
}
