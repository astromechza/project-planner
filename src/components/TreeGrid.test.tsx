import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useReducer } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialAppState,
  projectReducer,
  type ProjectAction,
} from '../app/projectReducer';
import { TaskInspector } from './TaskInspector';
import type { Project, TaskId } from '../domain/types';
import { TreeGrid } from './TreeGrid';

afterEach(cleanup);

const id = (value: string): TaskId => value as TaskId;
const doNothing = (): void => undefined;

const taskRowRect = (top: number): DOMRect => ({
  bottom: top + 36,
  height: 36,
  left: 0,
  right: 300,
  top,
  width: 300,
  x: 0,
  y: top,
  toJSON: (): Record<string, never> => ({}),
});

const dropZoneRect = (top: number): DOMRect => ({
  bottom: top + 8,
  height: 8,
  left: 0,
  right: 300,
  top,
  width: 300,
  x: 0,
  y: top,
  toJSON: (): Record<string, never> => ({}),
});

const createProject = (): Project => {
  const initiative = id('initiative');
  const epic = id('epic');
  const story = id('story');

  return {
    format: 'project-planner/v1',
    name: 'Health Hub plan',
    rootTaskIds: [initiative, story],
    tasks: {
      [initiative]: {
        id: initiative,
        title: 'Initiative',
        parentId: null,
        childIds: [epic],
      },
      [epic]: {
        id: epic,
        title: 'Epic',
        parentId: initiative,
        childIds: [],
      },
      [story]: {
        id: story,
        title: 'Story',
        parentId: null,
        childIds: [],
      },
    },
    dependencies: [],
  };
};

function TreeHarness(): React.JSX.Element {
  const [state, dispatch] = useReducer(
    projectReducer,
    createProject(),
    createInitialAppState,
  );

  const send = (action: ProjectAction): void => {
    dispatch(action);
  };

  return (
    <TreeGrid
      project={state.project}
      selectedTaskId={state.selectedTaskId}
      onSelect={(taskId) => {
        send({ type: 'select', taskId });
      }}
      onCreateSibling={(parentId, index) => {
        send({ type: 'create', parentId, title: 'Untitled task', index });
      }}
      onMove={(taskId, destination) => {
        send({ type: 'move', taskId, destination });
      }}
      onUpdateTask={(taskId, update) => {
        send({ type: 'update', taskId, update });
      }}
    />
  );
}

function TreeInspectorHarness(): React.JSX.Element {
  const [state, dispatch] = useReducer(
    projectReducer,
    createProject(),
    createInitialAppState,
  );

  return (
    <>
      <TreeGrid
        project={state.project}
        selectedTaskId={state.selectedTaskId}
        onSelect={(taskId) => {
          dispatch({ type: 'select', taskId });
        }}
        onCreateSibling={(parentId, index) => {
          dispatch({ type: 'create', parentId, title: 'Untitled task', index });
        }}
        onMove={(taskId, destination) => {
          dispatch({ type: 'move', taskId, destination });
        }}
        onUpdateTask={(taskId, update) => {
          dispatch({ type: 'update', taskId, update });
        }}
      />
      <TaskInspector
        project={state.project}
        selectedTaskId={state.selectedTaskId}
        onCreateChild={(parentId) => {
          dispatch({ type: 'create', parentId, title: 'Untitled task' });
        }}
        onUpdateTask={(taskId, update) => {
          dispatch({ type: 'update', taskId, update });
        }}
        onDeleteTask={(taskId) => {
          dispatch({ type: 'delete', taskId });
        }}
        onLinkDependency={(blockerId, blockedId) => {
          dispatch({ type: 'link', blockerId, blockedId });
        }}
        onUnlinkDependency={(blockerId, blockedId) => {
          dispatch({ type: 'unlink', blockerId, blockedId });
        }}
      />
    </>
  );
}

describe('TreeGrid', () => {
  it('opens keyboard shortcuts from a focused tree item', () => {
    const onShowShortcuts = vi.fn();
    render(
      <TreeGrid
        project={createProject()}
        selectedTaskId={null}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={doNothing}
        onUpdateTask={doNothing}
        onShowShortcuts={onShowShortcuts}
      />,
    );

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    initiative.focus();
    const event = fireEvent.keyDown(initiative, { key: '?' });

    expect(event).toBe(false);
    expect(onShowShortcuts).toHaveBeenCalledOnce();
  });

  it('opens keyboard shortcuts from the focusable empty tree', () => {
    const onShowShortcuts = vi.fn();
    render(
      <TreeGrid
        project={{ ...createProject(), rootTaskIds: [], tasks: {} }}
        selectedTaskId={null}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={doNothing}
        onUpdateTask={doNothing}
        onShowShortcuts={onShowShortcuts}
      />,
    );

    const emptyTree = screen.getByRole('tree', {
      name: 'Project task tree',
    });
    emptyTree.focus();
    fireEvent.keyDown(emptyTree, { key: '?' });

    expect(onShowShortcuts).toHaveBeenCalledWith(emptyTree);
  });

  it('does not open keyboard shortcuts while editing a title', () => {
    const onShowShortcuts = vi.fn();
    render(
      <TreeGrid
        project={createProject()}
        selectedTaskId={null}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={doNothing}
        onUpdateTask={doNothing}
        onShowShortcuts={onShowShortcuts}
      />,
    );

    fireEvent.doubleClick(screen.getByText('Initiative'));
    const titleInput = screen.getByRole('textbox', { name: 'Task title' });
    fireEvent.keyDown(titleInput, { key: '?' });

    expect(onShowShortcuts).not.toHaveBeenCalled();
  });

  it('does not open keyboard shortcuts from a drag handle', () => {
    const onShowShortcuts = vi.fn();
    render(
      <TreeGrid
        project={createProject()}
        selectedTaskId={null}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={doNothing}
        onUpdateTask={doNothing}
        onShowShortcuts={onShowShortcuts}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag Initiative' }), {
      key: '?',
    });

    expect(onShowShortcuts).not.toHaveBeenCalled();
  });

  it('selects a clicked task and makes it the roving tab stop', async () => {
    const user = userEvent.setup();
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    await user.click(initiative);

    expect(initiative).toHaveAttribute('aria-selected', 'true');
    expect(initiative).toHaveAttribute('tabindex', '0');
    expect(initiative).toHaveFocus();
    expect(screen.getByRole('treeitem', { name: 'Story' })).toHaveAttribute(
      'tabindex',
      '-1',
    );
  });

  it('marks the selected task and its direct blocker relationships', () => {
    const project = {
      ...createProject(),
      dependencies: [
        { blockerId: id('epic'), blockedId: id('initiative') },
        { blockerId: id('initiative'), blockedId: id('story') },
      ],
    };
    render(
      <TreeGrid
        project={project}
        selectedTaskId={id('initiative')}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={doNothing}
        onUpdateTask={doNothing}
      />,
    );

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.keyDown(initiative, { key: 'ArrowRight' });

    expect(initiative).toHaveClass('task-row--selected');
    expect(screen.getByRole('treeitem', { name: 'Epic' })).toHaveClass(
      'task-row--blocks-selected',
    );
    expect(screen.getByRole('treeitem', { name: 'Story' })).toHaveClass(
      'task-row--blocked-by-selected',
    );
  });

  it('marks a reciprocal relationship without hiding either direction', () => {
    const project = {
      ...createProject(),
      dependencies: [
        { blockerId: id('initiative'), blockedId: id('story') },
        { blockerId: id('story'), blockedId: id('initiative') },
      ],
    };
    render(
      <TreeGrid
        project={project}
        selectedTaskId={id('initiative')}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={doNothing}
        onUpdateTask={doNothing}
      />,
    );

    const story = screen.getByRole('treeitem', { name: 'Story' });

    expect(story).toHaveClass(
      'task-row--blocks-selected',
      'task-row--blocked-by-selected',
      'task-row--reciprocal-selected',
    );
    const descriptionId = story.getAttribute('aria-describedby');
    expect(descriptionId).not.toBeNull();
    expect(document.getElementById(descriptionId ?? '')).toHaveTextContent(
      'This task both blocks and is blocked by the selected task.',
    );
  });

  it('shows labelled drop zones while a task is being keyboard dragged', () => {
    render(<TreeHarness />);

    expect(
      screen.queryByRole('region', { name: 'Move before Initiative' }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Drag Story' }), {
      code: 'Space',
    });

    expect(screen.getByRole('tree')).toHaveClass('task-tree--dragging');
    expect(
      screen.getByRole('region', { name: 'Move before Initiative' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Move into Initiative' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Move after Initiative' }),
    ).toBeVisible();
  });

  it('moves a task into a parent by navigating keyboard drop zones', async () => {
    const user = userEvent.setup();
    const rectsByLabel: Readonly<Record<string, DOMRect>> = {
      Initiative: taskRowRect(0),
      Story: taskRowRect(80),
      'Move before Initiative': dropZoneRect(0),
      'Move into Initiative': dropZoneRect(12),
      'Move after Initiative': dropZoneRect(28),
      'Move before Story': dropZoneRect(68),
      'Move into Story': dropZoneRect(80),
      'Move after Story': dropZoneRect(108),
    };
    const getBoundingClientRect = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getPlannerRect(this: HTMLElement): DOMRect {
        return (
          rectsByLabel[this.getAttribute('aria-label') ?? ''] ??
          taskRowRect(200)
        );
      });

    try {
      render(<TreeHarness />);
      const storyDragHandle = screen.getByRole('button', {
        name: 'Drag Story',
      });
      storyDragHandle.focus();
      await user.keyboard('[Space]');
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0);
      });

      await user.keyboard('[ArrowUp][ArrowUp][ArrowRight][Enter]');

      fireEvent.click(
        screen.getByRole('button', { name: 'Expand Initiative' }),
      );
      await waitFor(() => {
        expect(screen.getByRole('treeitem', { name: 'Story' })).toHaveAttribute(
          'aria-level',
          '2',
        );
      });

      const movedStoryDragHandle = screen.getByRole('button', {
        name: 'Drag Story',
      });
      movedStoryDragHandle.focus();
      await user.keyboard('[Space][Escape]');
      expect(screen.getByText('Task move cancelled.')).toBeVisible();
    } finally {
      getBoundingClientRect.mockRestore();
    }
  });

  it('expands a task then selects its first child with ArrowRight', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'ArrowRight' });

    expect(screen.getByRole('treeitem', { name: 'Epic' })).toBeVisible();
    expect(initiative).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(initiative, { key: 'ArrowRight' });
    expect(screen.getByRole('treeitem', { name: 'Epic' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('treeitem', { name: 'Epic' })).toHaveFocus();
  });

  it('starts and selects an inline title edit with E on a focused task row', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'e' });

    const titleInput = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Task title',
    });
    expect(titleInput).toHaveFocus();
    expect(titleInput).toHaveValue('Initiative');
    expect(titleInput.selectionStart).toBe(0);
    expect(titleInput.selectionEnd).toBe('Initiative'.length);
  });

  it('does not start title editing for modified E keypresses', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'E', shiftKey: true });
    fireEvent.keyDown(initiative, { key: 'e', ctrlKey: true });

    expect(
      screen.queryByRole('textbox', { name: 'Task title' }),
    ).not.toBeInTheDocument();
  });

  it('refocuses the task row after saving an inline title edit', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'e' });
    const titleInput = screen.getByRole('textbox', { name: 'Task title' });
    fireEvent.change(titleInput, { target: { value: 'Renamed initiative' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    const renamedInitiative = screen.getByRole('treeitem', {
      name: 'Renamed initiative',
    });
    expect(renamedInitiative).toHaveFocus();
    fireEvent.keyDown(renamedInitiative, { key: 'ArrowDown' });
    expect(screen.getByRole('treeitem', { name: 'Story' })).toHaveFocus();
  });

  it('refocuses the task row after cancelling an inline title edit', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'e' });
    const titleInput = screen.getByRole('textbox', { name: 'Task title' });
    fireEvent.change(titleInput, { target: { value: 'Discarded initiative' } });
    fireEvent.keyDown(titleInput, { key: 'Escape' });

    const originalInitiative = screen.getByRole('treeitem', {
      name: 'Initiative',
    });
    expect(originalInitiative).toHaveFocus();
    fireEvent.keyDown(originalInitiative, { key: 'ArrowDown' });
    expect(screen.getByRole('treeitem', { name: 'Story' })).toHaveFocus();
  });

  it('creates a sibling with Shift+Enter but ignores plain Enter', () => {
    render(<TreeHarness />);

    const story = screen.getByRole('treeitem', { name: 'Story' });
    fireEvent.click(story);
    fireEvent.keyDown(story, { key: 'Enter' });

    expect(screen.getAllByRole('treeitem')).toHaveLength(2);

    fireEvent.keyDown(story, { key: 'Enter', shiftKey: true });

    expect(screen.getAllByRole('treeitem')).toHaveLength(3);
    const createdTask = screen.getByRole('treeitem', {
      name: 'Untitled task',
    });
    expect(createdTask).toHaveAttribute('aria-level', '1');
    expect(createdTask).toHaveFocus();

    fireEvent.keyDown(createdTask, { key: 'ArrowUp' });
    expect(screen.getByRole('treeitem', { name: 'Story' })).toHaveFocus();
  });

  it('moves a root task down and back up within its siblings', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'ArrowDown', shiftKey: true });

    expect(
      screen.getAllByRole('treeitem').map((item) => item.ariaLabel),
    ).toEqual(['Story', 'Initiative']);
    const movedInitiative = screen.getByRole('treeitem', {
      name: 'Initiative',
    });
    expect(movedInitiative).toHaveFocus();

    fireEvent.keyDown(movedInitiative, {
      key: 'ArrowUp',
      shiftKey: true,
    });

    expect(
      screen.getAllByRole('treeitem').map((item) => item.ariaLabel),
    ).toEqual(['Initiative', 'Story']);
    expect(screen.getByRole('treeitem', { name: 'Initiative' })).toHaveFocus();
  });

  it('moves a nested task within its parent siblings', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'ArrowRight' });
    const epic = screen.getByRole('treeitem', { name: 'Epic' });
    fireEvent.click(epic);
    fireEvent.keyDown(epic, { key: 'Enter', shiftKey: true });

    const createdTask = screen.getByRole('treeitem', {
      name: 'Untitled task',
    });
    fireEvent.keyDown(createdTask, { key: 'ArrowUp', shiftKey: true });

    expect(
      screen.getAllByRole('treeitem').map((item) => item.ariaLabel),
    ).toEqual(['Initiative', 'Untitled task', 'Epic', 'Story']);
    expect(
      screen.getByRole('treeitem', { name: 'Untitled task' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('treeitem', { name: 'Untitled task' }),
    ).toHaveAttribute('aria-level', '2');
  });

  it('does not move tasks beyond the first or last sibling position', () => {
    const onMove = vi.fn();
    render(
      <TreeGrid
        project={createProject()}
        selectedTaskId={null}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={onMove}
        onUpdateTask={doNothing}
      />,
    );

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'ArrowUp', shiftKey: true });

    const story = screen.getByRole('treeitem', { name: 'Story' });
    fireEvent.click(story);
    fireEvent.keyDown(story, { key: 'ArrowDown', shiftKey: true });

    expect(onMove).not.toHaveBeenCalled();
    expect(
      screen.getAllByRole('treeitem').map((item) => item.ariaLabel),
    ).toEqual(['Initiative', 'Story']);
  });

  it('shows aggregate story points for each visible subtree', () => {
    const baseProject = createProject();
    const initiative = id('initiative');
    const epic = id('epic');
    const story = id('story');
    const project: Project = {
      ...baseProject,
      rootTaskIds: [initiative],
      tasks: {
        ...baseProject.tasks,
        [initiative]: {
          ...baseProject.tasks[initiative],
          childIds: [epic],
          storyPoints: 3,
        },
        [epic]: {
          ...baseProject.tasks[epic],
          childIds: [story],
          storyPoints: 5,
        },
        [story]: {
          ...baseProject.tasks[story],
          parentId: epic,
          storyPoints: 14,
        },
      },
    };

    render(
      <TreeGrid
        project={project}
        selectedTaskId={initiative}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={doNothing}
        onUpdateTask={doNothing}
      />,
    );

    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'Initiative' }), {
      key: 'ArrowRight',
    });
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'Epic' }), {
      key: 'ArrowRight',
    });

    expect(
      screen.getByRole('img', { name: '22 story points' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '19 story points' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: '14 story points' }),
    ).toBeInTheDocument();
  });

  it('expands a collapsed parent after Add child so the selected child is visible', () => {
    render(<TreeInspectorHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    expect(initiative).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(initiative);
    fireEvent.click(screen.getByRole('button', { name: 'Add child' }));

    const createdTask = screen.getByRole('treeitem', {
      name: 'Untitled task',
    });
    expect(createdTask).toBeVisible();
    expect(createdTask).toHaveAttribute('aria-selected', 'true');
    expect(createdTask).toHaveAttribute('tabindex', '0');
    expect(createdTask).toHaveFocus();
  });

  it('adds a blocker relationship from the selected task inspector', () => {
    render(<TreeInspectorHarness />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'Initiative' }));
    fireEvent.change(screen.getByLabelText('Blocked by'), {
      target: { value: 'Story' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add blocker' }));

    expect(
      screen.getByRole('list', { name: 'Tasks blocking this task' }),
    ).toHaveTextContent('Story');
  });

  it('inserts a Shift+Enter-created sibling directly after the selected task', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'Enter', shiftKey: true });

    expect(
      screen.getAllByRole('treeitem').map((item) => item.ariaLabel),
    ).toEqual(['Initiative', 'Untitled task', 'Story']);
  });

  it('keeps the disclosure out of Tab traversal without indenting a task', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    const project = {
      ...createProject(),
      rootTaskIds: [id('story'), id('initiative')],
    };
    render(
      <TreeGrid
        project={project}
        selectedTaskId={id('initiative')}
        onSelect={doNothing}
        onCreateSibling={doNothing}
        onMove={onMove}
        onUpdateTask={doNothing}
      />,
    );

    const disclosure = screen.getByRole('button', {
      name: 'Expand Initiative',
    });
    expect(disclosure).toHaveAttribute('tabindex', '-1');
    disclosure.focus();
    await user.tab();

    expect(disclosure).not.toHaveFocus();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('indents a task under its preceding sibling with Tab', () => {
    render(<TreeHarness />);

    const story = screen.getByRole('treeitem', { name: 'Story' });
    fireEvent.click(story);
    fireEvent.keyDown(story, { key: 'Tab' });

    expect(screen.getByRole('treeitem', { name: 'Story' })).toHaveAttribute(
      'aria-level',
      '2',
    );
    expect(
      screen.getByRole('treeitem', { name: 'Initiative' }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('outdents a task after its parent with Shift+Tab', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'ArrowRight' });
    const epic = screen.getByRole('treeitem', { name: 'Epic' });
    fireEvent.click(epic);
    fireEvent.keyDown(epic, { key: 'Tab', shiftKey: true });

    expect(screen.getByRole('treeitem', { name: 'Epic' })).toHaveAttribute(
      'aria-level',
      '1',
    );
  });

  it('cancels an inline title edit with Escape', () => {
    render(<TreeHarness />);

    fireEvent.doubleClick(screen.getByText('Initiative'));
    const titleInput = screen.getByRole('textbox', { name: 'Task title' });
    fireEvent.change(titleInput, { target: { value: 'Renamed initiative' } });
    fireEvent.keyDown(titleInput, { key: 'Escape' });

    expect(
      screen.queryByRole('textbox', { name: 'Task title' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Initiative' })).toBeVisible();
  });

  it('selects and focuses the parent when its selected descendant is collapsed', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'ArrowRight' });
    const epic = screen.getByRole('treeitem', { name: 'Epic' });
    fireEvent.click(epic);

    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Initiative' }),
    );

    expect(screen.queryByRole('treeitem', { name: 'Epic' })).toBeNull();
    expect(initiative).toHaveAttribute('aria-selected', 'true');
    expect(initiative).toHaveFocus();
  });
});
