import { useDraggable } from '@dnd-kit/core';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DragController, resolveDropTarget } from './DragController';
import type { Project, TaskId } from '../domain/types';

const id = (value: string): TaskId => value as TaskId;

afterEach(cleanup);

const createProject = (): Project => {
  const initiative = id('initiative');
  const epic = id('epic');
  const story = id('story');
  const task = id('task');

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
        childIds: [task],
      },
      [story]: {
        id: story,
        title: 'Story',
        parentId: null,
        childIds: [],
      },
      [task]: {
        id: task,
        title: 'Task',
        parentId: epic,
        childIds: [],
      },
    },
    dependencies: [],
  };
};

function DraggableProbe(): React.JSX.Element {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef } =
    useDraggable({ id: id('story') });

  return (
    <div ref={setNodeRef}>
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Drag Story handle"
        {...attributes}
        {...listeners}
      >
        Drag Story
      </button>
    </div>
  );
}

describe('resolveDropTarget', () => {
  it('resolves a before zone to the target sibling position', () => {
    const result = resolveDropTarget(
      id('story'),
      id('initiative'),
      'before',
      createProject(),
    );

    expect(result).toEqual({ ok: true, value: { parentId: null, index: 0 } });
  });

  it('resolves an after zone to the position after its target', () => {
    const result = resolveDropTarget(
      id('initiative'),
      id('story'),
      'after',
      createProject(),
    );

    expect(result).toEqual({ ok: true, value: { parentId: null, index: 2 } });
  });

  it('resolves a child zone to the start of the target children', () => {
    const result = resolveDropTarget(
      id('story'),
      id('initiative'),
      'child',
      createProject(),
    );

    expect(result).toEqual({
      ok: true,
      value: { parentId: id('initiative'), index: 0 },
    });
  });

  it('rejects dropping a task onto one of its descendants', () => {
    const result = resolveDropTarget(
      id('initiative'),
      id('task'),
      'child',
      createProject(),
    );

    expect(result).toEqual({ ok: false, error: 'CYCLE' });
  });
});

describe('DragController', () => {
  it('starts with Space and ends with Enter, without allowing Enter to start a drag', async () => {
    render(
      <DragController project={createProject()} onMove={vi.fn()}>
        {({ activeTaskId }) => (
          <>
            <DraggableProbe />
            <p data-testid="drag-state">
              {activeTaskId === null ? 'not dragging' : 'dragging'}
            </p>
          </>
        )}
      </DragController>,
    );

    const handle = screen.getByRole('button', { name: 'Drag Story handle' });

    fireEvent.keyDown(handle, { code: 'Enter' });

    expect(screen.getByTestId('drag-state')).toHaveTextContent('not dragging');

    fireEvent.keyDown(handle, { code: 'Space' });

    expect(screen.getByTestId('drag-state')).toHaveTextContent('dragging');

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
    fireEvent.keyDown(document, { code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('drag-state')).toHaveTextContent(
        'not dragging',
      );
    });
  });
});
