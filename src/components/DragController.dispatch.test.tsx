import type { DragEndEvent } from '@dnd-kit/core';
import type * as DndKitCore from '@dnd-kit/core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DragController } from './DragController';
import type { Project, TaskId } from '../domain/types';

const id = (value: string): TaskId => value as TaskId;

const project: Project = {
  format: 'project-planner/v1',
  name: 'Health Hub plan',
  rootTaskIds: [id('initiative'), id('story')],
  tasks: {
    [id('initiative')]: {
      id: id('initiative'),
      title: 'Initiative',
      parentId: null,
      childIds: [],
    },
    [id('story')]: {
      id: id('story'),
      title: 'Story',
      parentId: null,
      childIds: [],
    },
  },
  dependencies: [],
};

const validDragEnd = {
  active: { id: id('story') },
  over: {
    data: {
      current: {
        kind: 'planner-drop-zone',
        targetId: id('initiative'),
        position: 'before',
      },
    },
  },
} as unknown as DragEndEvent;

const emptyDragEnd = {
  active: { id: id('story') },
  over: null,
} as unknown as DragEndEvent;

interface TestDndContextProps {
  readonly children?: ReactNode;
  readonly onDragEnd?: (event: DragEndEvent) => void;
}

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof DndKitCore>('@dnd-kit/core');

  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: TestDndContextProps) => (
      <div>
        {children}
        <button
          type="button"
          onClick={() => {
            onDragEnd?.(validDragEnd);
          }}
        >
          Complete valid drag
        </button>
        <button
          type="button"
          onClick={() => {
            onDragEnd?.(emptyDragEnd);
          }}
        >
          Complete empty drag
        </button>
      </div>
    ),
  };
});

afterEach(cleanup);

describe('DragController drop dispatch', () => {
  it('dispatches a resolved target to the tree move callback', () => {
    const onMove = vi.fn();
    render(
      <DragController project={project} onMove={onMove}>
        {() => <p>Planner tree</p>}
      </DragController>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete valid drag' }),
    );

    expect(onMove).toHaveBeenCalledWith(id('story'), {
      parentId: null,
      index: 0,
    });
  });

  it('does not dispatch when a drag has no destination and announces why', () => {
    const onMove = vi.fn();
    render(
      <DragController project={project} onMove={onMove}>
        {() => <p>Planner tree</p>}
      </DragController>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete empty drag' }),
    );

    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Task was not moved because no destination was selected.',
    );
  });
});
