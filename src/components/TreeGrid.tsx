import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent } from 'react';
import { getBlockedBy, getBlocks } from '../domain/dependencies';
import { getStoryPointsTotal } from '../domain/storyPoints';
import type { TaskDestination, TaskUpdate } from '../domain/tree';
import type { PlanTask, Project, TaskId } from '../domain/types';
import { DragController } from './DragController';
import { TreeRow } from './TreeRow';

interface TreeGridProps {
  readonly project: Project;
  readonly selectedTaskId: TaskId | null;
  readonly onSelect: (taskId: TaskId) => void;
  readonly onCreateSibling: (parentId: TaskId | null, index: number) => void;
  readonly onMove: (taskId: TaskId, destination: TaskDestination) => void;
  readonly onUpdateTask: (taskId: TaskId, update: TaskUpdate) => void;
  readonly onShowShortcuts?: (opener: HTMLElement) => void;
}

export interface TreeGridHandle {
  readonly collapseAll: () => void;
  readonly expandAll: () => void;
}

const collectCollapsibleTaskIds = (project: Project): Set<TaskId> =>
  new Set(
    Object.values(project.tasks)
      .filter((task) => task.childIds.length > 0)
      .map((task) => task.id),
  );

interface VisibleTask {
  readonly task: PlanTask;
  readonly depth: number;
}

interface DependencyCounts {
  readonly blocksCount: number;
  readonly blockedByCount: number;
}

const noDependencies: DependencyCounts = {
  blocksCount: 0,
  blockedByCount: 0,
};

const collectDependencyCounts = (
  project: Project,
): ReadonlyMap<TaskId, DependencyCounts> => {
  const dependencyCounts = new Map<TaskId, DependencyCounts>();

  const increment = (
    taskId: TaskId,
    relationship: keyof DependencyCounts,
  ): void => {
    const current = dependencyCounts.get(taskId) ?? noDependencies;
    dependencyCounts.set(taskId, {
      ...current,
      [relationship]: current[relationship] + 1,
    });
  };

  for (const dependency of project.dependencies) {
    increment(dependency.blockerId, 'blocksCount');
    increment(dependency.blockedId, 'blockedByCount');
  }

  return dependencyCounts;
};

const collectVisibleTasks = (
  project: Project,
  collapsedTaskIds: ReadonlySet<TaskId>,
): readonly VisibleTask[] => {
  const visibleTasks: VisibleTask[] = [];
  const visitedTaskIds = new Set<TaskId>();

  const visit = (taskId: TaskId, depth: number): void => {
    if (visitedTaskIds.has(taskId)) {
      return;
    }

    visitedTaskIds.add(taskId);
    const task = project.tasks[taskId];
    if (task === undefined) {
      return;
    }

    visibleTasks.push({ task, depth });
    if (collapsedTaskIds.has(taskId)) {
      return;
    }

    for (const childId of task.childIds) {
      visit(childId, depth + 1);
    }
  };

  for (const rootTaskId of project.rootTaskIds) {
    visit(rootTaskId, 1);
  }

  return visibleTasks;
};

const getSiblings = (project: Project, task: PlanTask): readonly TaskId[] =>
  task.parentId === null
    ? project.rootTaskIds
    : (project.tasks[task.parentId]?.childIds ?? []);

const isDescendant = (
  project: Project,
  ancestorTaskId: TaskId,
  candidateTaskId: TaskId,
): boolean => {
  const taskIdsToVisit = [...(project.tasks[ancestorTaskId]?.childIds ?? [])];
  const visitedTaskIds = new Set<TaskId>();

  while (taskIdsToVisit.length > 0) {
    const taskId = taskIdsToVisit.pop();
    if (taskId === undefined || visitedTaskIds.has(taskId)) {
      continue;
    }

    if (taskId === candidateTaskId) {
      return true;
    }

    visitedTaskIds.add(taskId);
    const task = project.tasks[taskId];
    if (task !== undefined) {
      taskIdsToVisit.push(...task.childIds);
    }
  }

  return false;
};

const getAncestorTaskIds = (
  project: Project,
  taskId: TaskId | null,
): ReadonlySet<TaskId> => {
  const ancestorTaskIds = new Set<TaskId>();
  const visitedTaskIds = new Set<TaskId>();
  let currentTaskId = taskId;

  while (currentTaskId !== null) {
    const parentTaskId = project.tasks[currentTaskId]?.parentId;
    if (parentTaskId === null || parentTaskId === undefined) {
      return ancestorTaskIds;
    }

    if (visitedTaskIds.has(parentTaskId)) {
      return ancestorTaskIds;
    }

    visitedTaskIds.add(parentTaskId);
    ancestorTaskIds.add(parentTaskId);
    currentTaskId = parentTaskId;
  }

  return ancestorTaskIds;
};

const getRootAncestorTaskId = (project: Project, taskId: TaskId): TaskId => {
  const visitedTaskIds = new Set<TaskId>();
  let currentTaskId = taskId;

  while (!visitedTaskIds.has(currentTaskId)) {
    visitedTaskIds.add(currentTaskId);
    const parentTaskId = project.tasks[currentTaskId]?.parentId;
    if (parentTaskId === null || parentTaskId === undefined) {
      return currentTaskId;
    }
    currentTaskId = parentTaskId;
  }

  return currentTaskId;
};

export const TreeGrid = forwardRef<TreeGridHandle, TreeGridProps>(
  function TreeGrid(
    {
      project,
      selectedTaskId,
      onSelect,
      onCreateSibling,
      onMove,
      onUpdateTask,
      onShowShortcuts,
    },
    ref,
  ): React.JSX.Element {
    const taskElements = useRef(new Map<TaskId, HTMLDivElement>());
    const [collapsedTaskIds, setCollapsedTaskIds] = useState<
      ReadonlySet<TaskId>
    >(() => collectCollapsibleTaskIds(project));

    useImperativeHandle(
      ref,
      () => ({
        collapseAll: () => {
          // Ancestors of the selection stay visually expanded, so move the
          // selection to its root-level ancestor to collapse the whole tree.
          if (selectedTaskId !== null) {
            const rootAncestorId = getRootAncestorTaskId(
              project,
              selectedTaskId,
            );
            if (rootAncestorId !== selectedTaskId) {
              onSelect(rootAncestorId);
            }
          }
          setCollapsedTaskIds(collectCollapsibleTaskIds(project));
        },
        expandAll: () => {
          setCollapsedTaskIds(new Set());
        },
      }),
      [project, selectedTaskId, onSelect],
    );
    const selectedTaskAncestorIds = useMemo(
      () => getAncestorTaskIds(project, selectedTaskId),
      [project, selectedTaskId],
    );
    const selectedTaskBlockerIds = useMemo(
      () =>
        selectedTaskId === null
          ? new Set<TaskId>()
          : new Set(getBlockedBy(project, selectedTaskId)),
      [project, selectedTaskId],
    );
    const selectedTaskBlockedIds = useMemo(
      () =>
        selectedTaskId === null
          ? new Set<TaskId>()
          : new Set(getBlocks(project, selectedTaskId)),
      [project, selectedTaskId],
    );
    const dependencyCounts = useMemo(
      () => collectDependencyCounts(project),
      [project],
    );
    const visibleCollapsedTaskIds = useMemo(
      () =>
        new Set(
          [...collapsedTaskIds].filter(
            (taskId) => !selectedTaskAncestorIds.has(taskId),
          ),
        ),
      [collapsedTaskIds, selectedTaskAncestorIds],
    );
    const visibleTasks = useMemo(
      () => collectVisibleTasks(project, visibleCollapsedTaskIds),
      [project, visibleCollapsedTaskIds],
    );
    const selectedTaskIsVisible = visibleTasks.some(
      ({ task }) => task.id === selectedTaskId,
    );
    const rovingTaskId =
      selectedTaskId !== null && selectedTaskIsVisible
        ? selectedTaskId
        : (visibleTasks[0]?.task.id ?? null);

    useLayoutEffect(() => {
      if (selectedTaskId !== null) {
        taskElements.current.get(selectedTaskId)?.focus();
      }
    }, [selectedTaskId]);

    const toggleCollapsed = (taskId: TaskId): void => {
      const isCollapsing = !collapsedTaskIds.has(taskId);
      if (
        isCollapsing &&
        selectedTaskId !== null &&
        isDescendant(project, taskId, selectedTaskId)
      ) {
        selectTask(taskId);
      }

      setCollapsedTaskIds((current) => {
        const next = new Set(current);
        if (next.has(taskId)) {
          next.delete(taskId);
        } else {
          next.add(taskId);
        }
        return next;
      });
    };

    const selectTask = (taskId: TaskId): void => {
      onSelect(taskId);
    };

    const registerTaskElement = (
      taskId: TaskId,
      element: HTMLDivElement | null,
    ): void => {
      if (element === null) {
        taskElements.current.delete(taskId);
        return;
      }

      taskElements.current.set(taskId, element);
    };

    const expand = (taskId: TaskId): void => {
      setCollapsedTaskIds((current) => {
        if (!current.has(taskId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    };

    const indent = (task: PlanTask): void => {
      const siblings = getSiblings(project, task);
      const index = siblings.indexOf(task.id);
      const precedingTaskId = index > 0 ? siblings[index - 1] : undefined;
      const precedingTask =
        precedingTaskId === undefined
          ? undefined
          : project.tasks[precedingTaskId];
      if (precedingTask === undefined) {
        return;
      }

      expand(precedingTask.id);
      onMove(task.id, {
        parentId: precedingTask.id,
        index: precedingTask.childIds.length,
      });
    };

    const outdent = (task: PlanTask): void => {
      if (task.parentId === null) {
        return;
      }

      const parent = project.tasks[task.parentId];
      if (parent === undefined) {
        return;
      }

      const parentSiblings = getSiblings(project, parent);
      const parentIndex = parentSiblings.indexOf(parent.id);
      if (parentIndex === -1) {
        return;
      }

      onMove(task.id, {
        parentId: parent.parentId,
        index: parentIndex + 1,
      });
    };

    const moveSibling = (task: PlanTask, direction: 'up' | 'down'): boolean => {
      const siblings = getSiblings(project, task);
      const currentIndex = siblings.indexOf(task.id);
      if (currentIndex === -1) {
        return false;
      }

      const targetIndex =
        direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) {
        return false;
      }

      onMove(task.id, {
        parentId: task.parentId,
        index: targetIndex > currentIndex ? targetIndex + 1 : targetIndex,
      });
      return true;
    };

    const handleKeyDown = (
      task: PlanTask,
      event: KeyboardEvent<HTMLDivElement>,
    ): void => {
      if (event.defaultPrevented) {
        return;
      }

      if (
        event.key === '?' &&
        event.target === event.currentTarget &&
        document.activeElement === event.currentTarget &&
        onShowShortcuts !== undefined
      ) {
        event.preventDefault();
        onShowShortcuts(event.currentTarget);
        return;
      }

      if (
        event.shiftKey &&
        (event.key === 'ArrowUp' || event.key === 'ArrowDown')
      ) {
        const moved = moveSibling(
          task,
          event.key === 'ArrowUp' ? 'up' : 'down',
        );
        if (moved) {
          event.preventDefault();
        }
        return;
      }

      const visibleTaskIndex = visibleTasks.findIndex(
        ({ task: visibleTask }) => visibleTask.id === task.id,
      );

      switch (event.key) {
        case 'ArrowDown': {
          const nextTask = visibleTasks[visibleTaskIndex + 1]?.task;
          if (nextTask !== undefined) {
            event.preventDefault();
            selectTask(nextTask.id);
          }
          return;
        }
        case 'ArrowUp': {
          const previousTask = visibleTasks[visibleTaskIndex - 1]?.task;
          if (previousTask !== undefined) {
            event.preventDefault();
            selectTask(previousTask.id);
          }
          return;
        }
        case 'ArrowRight':
          if (task.childIds.length > 0) {
            event.preventDefault();
            if (visibleCollapsedTaskIds.has(task.id)) {
              expand(task.id);
            } else {
              const firstChildId = task.childIds[0];
              if (firstChildId !== undefined) {
                selectTask(firstChildId);
              }
            }
          }
          return;
        case 'ArrowLeft':
          if (
            task.childIds.length > 0 &&
            !visibleCollapsedTaskIds.has(task.id)
          ) {
            event.preventDefault();
            toggleCollapsed(task.id);
          } else if (task.parentId !== null) {
            event.preventDefault();
            selectTask(task.parentId);
          }
          return;
        case 'Enter':
          if (!event.shiftKey) {
            return;
          }
          event.preventDefault();
          {
            const siblingIndex = getSiblings(project, task).indexOf(task.id);
            if (siblingIndex !== -1) {
              onCreateSibling(task.parentId, siblingIndex + 1);
            }
          }
          return;
        case 'Tab':
          event.preventDefault();
          if (event.shiftKey) {
            outdent(task);
          } else {
            indent(task);
          }
          return;
        default:
          return;
      }
    };

    return (
      <DragController project={project} onMove={onMove}>
        {({ activeTaskId }) => (
          <div
            className={`task-tree${activeTaskId === null ? '' : ' task-tree--dragging'}`}
            role="tree"
            aria-label="Project task tree"
            tabIndex={0}
            onKeyDown={(event) => {
              if (
                visibleTasks.length === 0 &&
                event.key === '?' &&
                event.target === event.currentTarget &&
                document.activeElement === event.currentTarget &&
                onShowShortcuts !== undefined
              ) {
                event.preventDefault();
                onShowShortcuts(event.currentTarget);
              }
            }}
          >
            {visibleTasks.length === 0 ? (
              <p className="task-tree-empty">
                No tasks yet. Add an initiative to start.
              </p>
            ) : (
              visibleTasks.map(({ task, depth }) => (
                <TreeRow
                  key={task.id}
                  task={task}
                  depth={depth}
                  selected={task.id === selectedTaskId}
                  blocksSelected={selectedTaskBlockerIds.has(task.id)}
                  blockedBySelected={selectedTaskBlockedIds.has(task.id)}
                  blocksCount={
                    (dependencyCounts.get(task.id) ?? noDependencies)
                      .blocksCount
                  }
                  blockedByCount={
                    (dependencyCounts.get(task.id) ?? noDependencies)
                      .blockedByCount
                  }
                  storyPointsTotal={getStoryPointsTotal(project, task.id)}
                  tabbable={task.id === rovingTaskId}
                  expanded={!visibleCollapsedTaskIds.has(task.id)}
                  dragging={activeTaskId !== null}
                  treeItemRef={(element) => {
                    registerTaskElement(task.id, element);
                  }}
                  onSelect={() => {
                    selectTask(task.id);
                  }}
                  onToggleExpanded={() => {
                    toggleCollapsed(task.id);
                  }}
                  onKeyDown={(event) => {
                    handleKeyDown(task, event);
                  }}
                  onUpdateTitle={(title) => {
                    onUpdateTask(task.id, { title });
                  }}
                />
              ))
            )}
          </div>
        )}
      </DragController>
    );
  },
);
