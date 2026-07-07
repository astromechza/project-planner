import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectApp } from './ProjectApp';

const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'showModal',
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  'close',
);

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function showModal(this: HTMLDialogElement): void {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function close(this: HTMLDialogElement): void {
        this.open = false;
      },
    },
  });
});

afterEach(cleanup);

afterEach(() => {
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

describe('ProjectApp', () => {
  it('renders the project planner main landmark', () => {
    render(<ProjectApp />);

    expect(
      screen.getByRole('main', { name: 'Project planner' }),
    ).toBeInTheDocument();
  });

  it('edits story points from the selected task inspector', () => {
    render(<ProjectApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Add initiative' }));
    const storyPoints = screen.getByLabelText('Story points');
    fireEvent.change(storyPoints, { target: { value: '14' } });

    expect(storyPoints).toHaveValue('14');
  });

  it('shows and copies the selected task internal ID', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    try {
      render(<ProjectApp />);

      fireEvent.click(screen.getByRole('button', { name: 'Add initiative' }));

      expect(screen.getByText('Internal ID')).toBeInTheDocument();
      const copyButton = screen.getByRole('button', {
        name: 'Copy internal ID',
      });
      const internalId = screen.getByLabelText('Internal ID value').textContent;

      expect(internalId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      fireEvent.click(copyButton);

      expect(writeText).toHaveBeenCalledWith(internalId);
    } finally {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('renames the plan by double-clicking its title', () => {
    render(<ProjectApp />);

    fireEvent.doubleClick(
      screen.getByRole('heading', { name: 'Untitled plan' }),
    );

    const titleInput = screen.getByRole('textbox', { name: 'Plan title' });
    expect(titleInput).toHaveValue('Untitled plan');

    fireEvent.change(titleInput, { target: { value: 'Health Hub plan' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    expect(
      screen.getByRole('heading', { name: 'Health Hub plan' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Plan title' }),
    ).not.toBeInTheDocument();
  });

  it('resizes the task inspector by dragging the workspace divider', () => {
    render(<ProjectApp />);

    const workspace = screen.getByRole('region', { name: 'Plan workspace' });
    const splitter = screen.getByRole('separator', {
      name: 'Resize task inspector',
    });
    const maximumWidth = Math.max(288, window.innerWidth - 288);

    expect(splitter).toHaveAttribute('aria-orientation', 'vertical');
    expect(splitter).toHaveAttribute('aria-valuenow', '448');
    expect(splitter).toHaveAttribute('aria-valuemax', maximumWidth.toString());

    fireEvent.pointerDown(splitter, { pointerId: 1 });
    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 700 });

    const expectedWidth = Math.min(640, Math.max(288, window.innerWidth - 700));
    expect(workspace).toHaveStyle(
      `--inspector-width: ${expectedWidth.toString()}px`,
    );
    expect(splitter).toHaveAttribute('aria-valuenow', expectedWidth.toString());

    fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 0 });

    expect(workspace).toHaveStyle(
      `--inspector-width: ${maximumWidth.toString()}px`,
    );
    expect(splitter).toHaveAttribute('aria-valuenow', maximumWidth.toString());
  });

  it('remains usable when browser recovery storage is unavailable', () => {
    const localStorageGetter = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new DOMException('Storage access is blocked.', 'SecurityError');
      });

    try {
      render(<ProjectApp />);

      expect(
        screen.getByRole('main', { name: 'Project planner' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Add initiative' }),
      ).toBeEnabled();
    } finally {
      localStorageGetter.mockRestore();
    }
  });

  it('opens keyboard shortcuts from the persistent toolbar button and restores focus after Escape', () => {
    render(<ProjectApp />);

    const opener = screen.getByRole('button', {
      name: 'Keyboard shortcuts',
    });
    expect(opener).toHaveAttribute('aria-haspopup', 'dialog');
    expect(opener).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', {
      name: 'Keyboard shortcuts',
    });
    expect(opener).toHaveAttribute('aria-expanded', 'true');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    expect(
      screen.queryByRole('dialog', { name: 'Keyboard shortcuts' }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('restores focus to the tree item that opened keyboard shortcuts', () => {
    render(<ProjectApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Add initiative' }));
    const initiative = screen.getByRole('treeitem', {
      name: 'Untitled initiative',
    });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: '?' });

    const dialog = screen.getByRole('dialog', {
      name: 'Keyboard shortcuts',
    });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    expect(initiative).toHaveFocus();
  });

  it('shows an empty-plan keyboard shortcut hint beside Add initiative', () => {
    render(<ProjectApp />);

    expect(screen.getByText('Need shortcuts? Press ?')).toBeInTheDocument();
  });

  it('hides collapse and expand all until the plan has tasks', () => {
    render(<ProjectApp />);

    expect(
      screen.queryByRole('button', { name: 'Collapse all' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Expand all' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add initiative' }));

    expect(
      screen.getByRole('button', { name: 'Collapse all' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Expand all' }),
    ).toBeInTheDocument();
  });

  it('collapses and expands the whole tree with the header buttons', () => {
    render(<ProjectApp />);

    fireEvent.click(screen.getByRole('button', { name: 'Add initiative' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add child' }));

    expect(
      screen.getByRole('button', { name: 'Collapse Untitled initiative' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));

    expect(
      screen.getByRole('button', { name: 'Expand Untitled initiative' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('treeitem', { name: 'Untitled task' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));

    expect(
      screen.getByRole('treeitem', { name: 'Untitled task' }),
    ).toBeInTheDocument();
  });
});
