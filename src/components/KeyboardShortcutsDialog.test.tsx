import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useEffect, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KeyboardShortcutsDialog,
  SHORTCUT_GROUPS,
} from './KeyboardShortcutsDialog';

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);
const nativeDialogMethods = {
  showModal: vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  }),
  close: vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  }),
};

beforeEach(() => {
  nativeDialogMethods.showModal.mockClear();
  nativeDialogMethods.close.mockClear();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: nativeDialogMethods.showModal },
    close: { configurable: true, value: nativeDialogMethods.close },
  });
});

afterEach(() => {
  cleanup();
  if (originalShowModal === undefined) {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  } else {
    Object.defineProperty(
      HTMLDialogElement.prototype,
      'showModal',
      originalShowModal,
    );
  }
  if (originalClose === undefined) {
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  } else {
    Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  }
});

function DialogHarness(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      openerRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Keyboard shortcuts
      </button>
      <KeyboardShortcutsDialog
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
      />
    </>
  );
}

describe('KeyboardShortcutsDialog', () => {
  it('distinguishes title-edit and drag-handle shortcuts from tree controls', () => {
    render(<KeyboardShortcutsDialog open onClose={vi.fn()} />);

    expect(screen.getByText('Save title edit')).toBeInTheDocument();
    expect(SHORTCUT_GROUPS[1]?.shortcuts).toContainEqual({
      keys: ['Shift', 'Enter'],
      description: 'Create the next sibling',
    });
    expect(SHORTCUT_GROUPS[1]?.shortcuts).toContainEqual({
      keys: ['E'],
      description: 'Edit title',
    });
    expect(SHORTCUT_GROUPS[1]?.shortcuts).toContainEqual({
      keys: ['Shift', 'Arrow Up'],
      description: 'Move a task up within its siblings',
    });
    expect(SHORTCUT_GROUPS[1]?.shortcuts).toContainEqual({
      keys: ['Shift', 'Arrow Down'],
      description: 'Move a task down within its siblings',
    });
    expect(
      screen.getByRole('heading', {
        name: 'Drag and drop (task drag handle focused)',
      }),
    ).toBeInTheDocument();
  });

  it('renders every documented shortcut in semantic groups', () => {
    render(<KeyboardShortcutsDialog open onClose={vi.fn()} />);

    expect(
      screen.getByRole('dialog', { name: 'Keyboard shortcuts' }),
    ).toHaveAttribute('aria-modal', 'true');

    for (const group of SHORTCUT_GROUPS) {
      expect(
        screen.getByRole('heading', { name: group.title }),
      ).toBeInTheDocument();

      for (const shortcut of group.shortcuts) {
        expect(screen.getByText(shortcut.description)).toBeInTheDocument();
        for (const key of shortcut.keys) {
          expect(
            screen
              .getAllByText(key)
              .some((element) => element.tagName === 'KBD'),
          ).toBe(true);
        }
      }
    }
  });

  it('opens from a caller with a native modal and focuses Close', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);

    await user.click(
      screen.getByRole('button', { name: 'Keyboard shortcuts' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'Keyboard shortcuts' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(nativeDialogMethods.showModal).toHaveBeenCalledOnce();
  });

  it('closes the native modal when controlled state changes', () => {
    const { rerender } = render(
      <KeyboardShortcutsDialog open onClose={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });

    expect(dialog).toHaveProperty('open', true);

    rerender(<KeyboardShortcutsDialog open={false} onClose={vi.fn()} />);

    expect(nativeDialogMethods.close).toHaveBeenCalledOnce();
    expect(dialog).toHaveProperty('open', false);
  });

  it('tolerates a native InvalidStateError while showing the dialog', () => {
    nativeDialogMethods.showModal.mockImplementationOnce(() => {
      throw new DOMException(
        'The dialog is already open.',
        'InvalidStateError',
      );
    });

    expect(() => {
      render(<KeyboardShortcutsDialog open onClose={vi.fn()} />);
    }).not.toThrow();
  });

  it('uses the native cancel event to close and lets its caller restore focus', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Keyboard shortcuts' });

    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    const cancelEvent = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('calls onClose from its Close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog open onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Tab focus within the dialog instead of moving to another control', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Outside dialog</button>
        <KeyboardShortcutsDialog open onClose={vi.fn()} />
      </>,
    );

    const close = screen.getByRole('button', { name: 'Close' });
    const outside = screen.getByRole('button', { name: 'Outside dialog' });
    expect(close).toHaveFocus();

    await user.tab();

    expect(close).toHaveFocus();
    expect(outside).not.toHaveFocus();

    await user.tab({ shift: true });

    expect(close).toHaveFocus();
  });
});
