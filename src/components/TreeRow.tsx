import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { DropPosition } from './DragController';
import type { PlanTask } from '../domain/types';
import { TaskNotesIndicator } from './TaskNotesIndicator';
import { StoryPointsIndicator } from './StoryPointsIndicator';
import { TaskTypeIcon } from './TaskTypeIcon';

interface TreeRowProps {
  readonly task: PlanTask;
  readonly depth: number;
  readonly selected: boolean;
  readonly blocksSelected: boolean;
  readonly blockedBySelected: boolean;
  readonly blocksCount: number;
  readonly blockedByCount: number;
  readonly storyPointsTotal: number;
  readonly tabbable: boolean;
  readonly expanded: boolean;
  readonly dragging: boolean;
  readonly treeItemRef: (element: HTMLDivElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onToggleExpanded: () => void;
  readonly onUpdateTitle: (title: string) => void;
}

interface DropZoneProps {
  readonly task: PlanTask;
  readonly position: DropPosition;
  readonly dragging: boolean;
}

const dropZoneLabels: Readonly<Record<DropPosition, string>> = {
  before: 'Move before',
  child: 'Move into',
  after: 'Move after',
};

function DropZone({
  task,
  position,
  dragging,
}: DropZoneProps): React.JSX.Element {
  const { isOver, setNodeRef } = useDroppable({
    id: `planner-drop-zone:${position}:${task.id}`,
    data: { kind: 'planner-drop-zone', targetId: task.id, position },
  });

  return (
    <span
      ref={setNodeRef}
      role="region"
      aria-label={`${dropZoneLabels[position]} ${task.title}`}
      aria-hidden={!dragging}
      className={`task-drop-zone task-drop-zone--${position}${isOver ? ' task-drop-zone--over' : ''}`}
    />
  );
}

export function TreeRow({
  task,
  depth,
  selected,
  blocksSelected,
  blockedBySelected,
  blocksCount,
  blockedByCount,
  storyPointsTotal,
  tabbable,
  expanded,
  dragging,
  treeItemRef,
  onSelect,
  onKeyDown,
  onToggleExpanded,
  onUpdateTitle,
}: TreeRowProps): React.JSX.Element {
  const {
    attributes: dragAttributes,
    isDragging,
    listeners: dragListeners,
    setActivatorNodeRef,
    setNodeRef,
  } = useDraggable({ id: task.id });
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const treeItemElementRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingKeyboardExitRef = useRef(false);
  const hasChildren = task.childIds.length > 0;
  const hasDependencies = blocksCount > 0 || blockedByCount > 0;
  const hasNotes = (task.notes?.trim().length ?? 0) > 0;
  const hasReciprocalRelationship = blocksSelected && blockedBySelected;
  const blocksLabel = `Blocks ${String(blocksCount)} ${blocksCount === 1 ? 'task' : 'tasks'}`;
  const blockedByLabel = `is blocked by ${String(blockedByCount)} ${blockedByCount === 1 ? 'task' : 'tasks'}`;
  const generatedDescriptionId = useId();
  const reciprocalDescriptionId = hasReciprocalRelationship
    ? generatedDescriptionId
    : undefined;

  const saveTitle = (focusAfterSave = false): void => {
    if (draftTitle !== task.title) {
      onUpdateTitle(draftTitle);
    }
    if (focusAfterSave) {
      pendingKeyboardExitRef.current = true;
    }
    setIsEditing(false);
  };

  const cancelEditing = (focusAfterCancel = false): void => {
    setDraftTitle(task.title);
    if (focusAfterCancel) {
      pendingKeyboardExitRef.current = true;
    }
    setIsEditing(false);
  };

  const startEditing = (): void => {
    setDraftTitle(task.title);
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    } else if (pendingKeyboardExitRef.current) {
      pendingKeyboardExitRef.current = false;
      treeItemElementRef.current?.focus();
    }
  }, [isEditing]);

  const handleTitleBlur = (): void => {
    if (pendingKeyboardExitRef.current) {
      return;
    }
    saveTitle();
  };

  const setTreeItemRef = (element: HTMLDivElement | null): void => {
    treeItemElementRef.current = element;
    setNodeRef(element);
    treeItemRef(element);
  };

  return (
    <div
      role="treeitem"
      ref={setTreeItemRef}
      aria-label={task.title}
      aria-level={depth}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-describedby={reciprocalDescriptionId}
      tabIndex={tabbable ? 0 : -1}
      className={`task-tree-row${selected ? ' task-row--selected' : ''}${blocksSelected ? ' task-row--blocks-selected' : ''}${blockedBySelected ? ' task-row--blocked-by-selected' : ''}${hasReciprocalRelationship ? ' task-row--reciprocal-selected' : ''}${isDragging ? ' task-row--dragged' : ''}`}
      style={{ paddingInlineStart: (depth - 1) * 24 }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (
          event.key === 'e' &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.target === event.currentTarget &&
          document.activeElement === event.currentTarget
        ) {
          event.preventDefault();
          startEditing();
          return;
        }

        onKeyDown(event);
      }}
    >
      <DropZone task={task} position="before" dragging={dragging} />
      <DropZone task={task} position="child" dragging={dragging} />
      <DropZone task={task} position="after" dragging={dragging} />
      {hasChildren ? (
        <button
          type="button"
          className="task-tree-disclosure"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${task.title}`}
          aria-expanded={expanded}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          {expanded ? '⌄' : '›'}
        </button>
      ) : (
        <span className="task-tree-disclosure-placeholder" aria-hidden="true" />
      )}
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="task-drag-handle"
        aria-label={`Drag ${task.title}`}
        {...dragAttributes}
        {...dragListeners}
        onClick={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          dragListeners?.onKeyDown?.(event);
          if (!isDragging) {
            event.stopPropagation();
            return;
          }

          event.preventDefault();
        }}
      >
        ⠿
      </button>
      <TaskTypeIcon depth={depth} />
      {isEditing ? (
        <input
          aria-label="Task title"
          value={draftTitle}
          ref={titleInputRef}
          onChange={(event) => {
            setDraftTitle(event.currentTarget.value);
          }}
          onBlur={handleTitleBlur}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              saveTitle(true);
            } else if (event.key === 'Escape') {
              cancelEditing(true);
            }
          }}
        />
      ) : (
        <span className="task-tree-title" onDoubleClick={startEditing}>
          {task.title}
        </span>
      )}
      <TaskNotesIndicator hasNotes={hasNotes} />
      <StoryPointsIndicator total={storyPointsTotal} />
      {hasDependencies ? (
        <span
          className="task-dependency-indicator"
          role="img"
          aria-label={`${blocksLabel} and ${blockedByLabel}`}
        >
          <span aria-hidden="true">
            ↗{blocksCount} ↙{blockedByCount}
          </span>
        </span>
      ) : null}
      {hasReciprocalRelationship ? (
        <span id={reciprocalDescriptionId} className="visually-hidden">
          This task both blocks and is blocked by the selected task.
        </span>
      ) : null}
    </div>
  );
}
