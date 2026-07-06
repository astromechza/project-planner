import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCodes,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { moveTask, type TaskDestination, type TreeError } from '../domain/tree';
import type { Result } from '../domain/result';
import type { Project, TaskId } from '../domain/types';

export type DropPosition = 'before' | 'child' | 'after';

export type DropTargetError = TreeError | 'INVALID_DROP_TARGET';

interface DropZoneData {
  readonly kind: 'planner-drop-zone';
  readonly targetId: TaskId;
  readonly position: DropPosition;
}

interface DropZoneCandidate {
  readonly id: UniqueIdentifier;
  readonly data: DropZoneData;
  readonly order: number;
  readonly rect: { readonly left: number; readonly top: number };
}

interface DragControllerProps {
  readonly project: Project;
  readonly onMove: (taskId: TaskId, destination: TaskDestination) => void;
  readonly children: (state: DragControllerState) => ReactNode;
}

export interface DragControllerState {
  readonly activeTaskId: TaskId | null;
}

const plannerKeyboardCodes: KeyboardCodes = {
  start: ['Space'],
  end: ['Enter'],
  cancel: ['Escape'],
};

const failure = <E extends string>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

const success = <T,>(value: T): Result<T, never> => ({ ok: true, value });

const getSiblingIds = (
  project: Project,
  taskId: TaskId,
): readonly TaskId[] | undefined => {
  const task = project.tasks[taskId];
  if (task === undefined) {
    return undefined;
  }

  return task.parentId === null
    ? project.rootTaskIds
    : project.tasks[task.parentId]?.childIds;
};

const getKnownTaskId = (
  project: Project,
  candidate: UniqueIdentifier,
): TaskId | undefined =>
  typeof candidate === 'string' && Object.hasOwn(project.tasks, candidate)
    ? (candidate as TaskId)
    : undefined;

const getDropZoneData = (value: unknown): DropZoneData | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Readonly<Record<string, unknown>>;
  const targetId = candidate.targetId;
  const position = candidate.position;
  if (
    candidate.kind !== 'planner-drop-zone' ||
    typeof targetId !== 'string' ||
    (position !== 'before' && position !== 'child' && position !== 'after')
  ) {
    return undefined;
  }

  return { kind: 'planner-drop-zone', targetId: targetId as TaskId, position };
};

const collectDropZoneCandidates = (
  context: Parameters<KeyboardCoordinateGetter>[1]['context'],
): readonly DropZoneCandidate[] => {
  const candidates: DropZoneCandidate[] = [];
  let order = 0;

  context.droppableContainers.getEnabled().forEach((container) => {
    const data = getDropZoneData(container.data.current);
    const rect = context.droppableRects.get(container.id);
    if (data !== undefined && rect !== undefined) {
      candidates.push({ id: container.id, data, order, rect });
      order += 1;
    }
  });

  return candidates;
};

const findCandidate = (
  candidates: readonly DropZoneCandidate[],
  id: UniqueIdentifier | null,
): DropZoneCandidate | undefined =>
  id === null ? undefined : candidates.find((candidate) => candidate.id === id);

const selectVerticalCandidate = (
  candidates: readonly DropZoneCandidate[],
  currentTop: number,
  direction: 'up' | 'down',
): DropZoneCandidate | undefined => {
  const directionalCandidates = candidates.filter((candidate) =>
    direction === 'up'
      ? candidate.rect.top < currentTop
      : candidate.rect.top > currentTop,
  );
  return directionalCandidates.sort((left, right) =>
    direction === 'up'
      ? right.rect.top - left.rect.top || right.order - left.order
      : left.rect.top - right.rect.top || left.order - right.order,
  )[0];
};

export const resolveDropTarget = (
  activeId: TaskId,
  targetId: TaskId,
  position: DropPosition,
  project: Project,
): Result<TaskDestination, DropTargetError> => {
  const activeTask = project.tasks[activeId];
  const targetTask = project.tasks[targetId];
  if (activeTask === undefined || targetTask === undefined) {
    return failure('TASK_NOT_FOUND');
  }

  if (activeId === targetId) {
    return failure('INVALID_DROP_TARGET');
  }

  const targetSiblingIds = getSiblingIds(project, targetId);
  if (targetSiblingIds === undefined) {
    return failure('PARENT_NOT_FOUND');
  }

  const targetIndex = targetSiblingIds.indexOf(targetId);
  if (targetIndex === -1) {
    return failure('INVALID_INDEX');
  }

  const destination: TaskDestination =
    position === 'child'
      ? { parentId: targetId, index: 0 }
      : {
          parentId: targetTask.parentId,
          index: targetIndex + (position === 'after' ? 1 : 0),
        };
  const validation = moveTask(project, activeTask.id, destination);

  return validation.ok ? success(destination) : failure(validation.error);
};

export function DragController({
  project,
  onMove,
  children,
}: DragControllerProps): React.JSX.Element {
  const [activeTaskId, setActiveTaskId] = useState<TaskId | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const keyboardDropZoneId = useRef<UniqueIdentifier | null>(null);
  const coordinateGetter = useCallback<KeyboardCoordinateGetter>(
    (event, { active, context, currentCoordinates }) => {
      const fallback = sortableKeyboardCoordinates(event, {
        context,
        currentCoordinates,
        active,
      });
      if (
        event.code !== 'ArrowUp' &&
        event.code !== 'ArrowDown' &&
        event.code !== 'ArrowLeft' &&
        event.code !== 'ArrowRight'
      ) {
        return fallback;
      }

      const candidates = collectDropZoneCandidates(context);
      const currentCandidate = findCandidate(
        candidates,
        keyboardDropZoneId.current,
      );
      const selectedCandidate =
        event.code === 'ArrowUp'
          ? selectVerticalCandidate(
              candidates,
              currentCandidate?.rect.top ?? currentCoordinates.y,
              'up',
            )
          : event.code === 'ArrowDown'
            ? selectVerticalCandidate(
                candidates,
                currentCandidate?.rect.top ?? currentCoordinates.y,
                'down',
              )
            : currentCandidate === undefined
              ? undefined
              : candidates.find(
                  (candidate) =>
                    candidate.data.targetId ===
                      currentCandidate.data.targetId &&
                    candidate.data.position ===
                      (event.code === 'ArrowRight' ? 'child' : 'before'),
                );
      if (selectedCandidate === undefined) {
        return fallback;
      }

      keyboardDropZoneId.current = selectedCandidate.id;
      return {
        x: selectedCandidate.rect.left,
        y: selectedCandidate.rect.top,
      };
    },
    [],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter,
      keyboardCodes: plannerKeyboardCodes,
    }),
  );

  const handleDragStart = (event: DragStartEvent): void => {
    keyboardDropZoneId.current = null;
    const taskId = getKnownTaskId(project, event.active.id);
    if (taskId === undefined) {
      setAnnouncement(
        'Task move could not start because the task is unavailable.',
      );
      return;
    }

    setAnnouncement('');
    setActiveTaskId(taskId);
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveTaskId(null);
    keyboardDropZoneId.current = null;
    const activeId = getKnownTaskId(project, event.active.id);
    if (activeId === undefined) {
      setAnnouncement('Task was not moved because the task is unavailable.');
      return;
    }

    if (event.over === null) {
      setAnnouncement(
        'Task was not moved because no destination was selected.',
      );
      return;
    }

    const dropZone = getDropZoneData(event.over.data.current);
    if (dropZone === undefined) {
      setAnnouncement(
        'Task was not moved because that destination is invalid.',
      );
      return;
    }

    const destination = resolveDropTarget(
      activeId,
      dropZone.targetId,
      dropZone.position,
      project,
    );
    if (!destination.ok) {
      setAnnouncement(
        'Task was not moved because that destination is invalid.',
      );
      return;
    }

    onMove(activeId, destination.value);
    setAnnouncement(`Moved ${project.tasks[activeId]?.title ?? 'task'}.`);
  };

  const handleDragCancel = (): void => {
    setActiveTaskId(null);
    keyboardDropZoneId.current = null;
    setAnnouncement('Task move cancelled.');
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children({ activeTaskId })}
      <p className="task-drag-announcement" role="status" aria-live="polite">
        {announcement}
      </p>
    </DndContext>
  );
}
