import { getTaskDepth } from './project';
import type { Result } from './result';
import type { PlanTask, Project, StoryPoints, TaskId } from './types';

const maximumTaskDepth = 5;

export type TreeError =
  | 'TASK_NOT_FOUND'
  | 'PARENT_NOT_FOUND'
  | 'MAX_DEPTH_EXCEEDED'
  | 'CYCLE'
  | 'INVALID_INDEX';

export interface TaskDestination {
  readonly parentId: TaskId | null;
  readonly index: number;
}

export interface TaskUpdate {
  readonly title?: string;
  readonly notes?: string;
  readonly storyPoints?: StoryPoints | undefined;
}

export const newTaskId = (): TaskId => crypto.randomUUID() as TaskId;

const success = <T>(value: T): Result<T, never> => ({ ok: true, value });

const failure = <E extends string>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

const insertTaskId = (
  taskIds: readonly TaskId[],
  taskId: TaskId,
  index: number,
): readonly TaskId[] => [
  ...taskIds.slice(0, index),
  taskId,
  ...taskIds.slice(index),
];

const removeTaskId = (
  taskIds: readonly TaskId[],
  taskId: TaskId,
): readonly TaskId[] => taskIds.filter((candidateId) => candidateId !== taskId);

const collectSubtreeTaskIds = (
  project: Project,
  taskId: TaskId,
  collectedIds = new Set<TaskId>(),
): ReadonlySet<TaskId> => {
  if (collectedIds.has(taskId)) {
    return collectedIds;
  }

  collectedIds.add(taskId);
  const task = project.tasks[taskId];

  if (task === undefined) {
    return collectedIds;
  }

  for (const childId of task.childIds) {
    collectSubtreeTaskIds(project, childId, collectedIds);
  }

  return collectedIds;
};

const getSubtreeHeight = (project: Project, taskId: TaskId): number => {
  const depths = new Map<TaskId, number>();
  const visit = (currentTaskId: TaskId, depth: number): void => {
    if (depths.has(currentTaskId)) {
      return;
    }

    depths.set(currentTaskId, depth);
    const task = project.tasks[currentTaskId];

    if (task !== undefined) {
      for (const childId of task.childIds) {
        visit(childId, depth + 1);
      }
    }
  };

  visit(taskId, 1);

  let maximumDepth = 0;
  for (const depth of depths.values()) {
    maximumDepth = Math.max(maximumDepth, depth);
  }

  return maximumDepth;
};

const getParentTask = (
  project: Project,
  parentId: TaskId | null,
): PlanTask | undefined =>
  parentId === null ? undefined : project.tasks[parentId];

export const addTask = (
  project: Project,
  parentId: TaskId | null,
  title: string,
  index?: number,
): Result<
  { readonly project: Project; readonly task: PlanTask },
  TreeError
> => {
  const parent = getParentTask(project, parentId);

  if (parentId !== null && parent === undefined) {
    return failure('PARENT_NOT_FOUND');
  }

  if (parentId !== null) {
    const parentDepth = getTaskDepth(project, parentId);

    if (parentDepth === undefined) {
      return failure('PARENT_NOT_FOUND');
    }

    if (parentDepth >= maximumTaskDepth) {
      return failure('MAX_DEPTH_EXCEEDED');
    }
  }

  const task: PlanTask = {
    id: newTaskId(),
    title,
    parentId,
    childIds: [],
  };

  const siblingTaskIds =
    parent === undefined ? project.rootTaskIds : parent.childIds;
  const insertionIndex = index ?? siblingTaskIds.length;
  if (
    !Number.isInteger(insertionIndex) ||
    insertionIndex < 0 ||
    insertionIndex > siblingTaskIds.length
  ) {
    return failure('INVALID_INDEX');
  }

  if (parent === undefined) {
    return success({
      project: {
        ...project,
        rootTaskIds: insertTaskId(project.rootTaskIds, task.id, insertionIndex),
        tasks: { ...project.tasks, [task.id]: task },
      },
      task,
    });
  }

  return success({
    project: {
      ...project,
      tasks: {
        ...project.tasks,
        [parent.id]: {
          ...parent,
          childIds: insertTaskId(parent.childIds, task.id, insertionIndex),
        },
        [task.id]: task,
      },
    },
    task,
  });
};

export const moveTask = (
  project: Project,
  taskId: TaskId,
  destination: TaskDestination,
): Result<Project, TreeError> => {
  const task = project.tasks[taskId];

  if (task === undefined) {
    return failure('TASK_NOT_FOUND');
  }

  const sourceParent = getParentTask(project, task.parentId);
  if (task.parentId !== null && sourceParent === undefined) {
    return failure('PARENT_NOT_FOUND');
  }

  const destinationParent = getParentTask(project, destination.parentId);
  if (destination.parentId !== null && destinationParent === undefined) {
    return failure('PARENT_NOT_FOUND');
  }

  const movedSubtreeIds = collectSubtreeTaskIds(project, taskId);
  if (
    destination.parentId !== null &&
    movedSubtreeIds.has(destination.parentId)
  ) {
    return failure('CYCLE');
  }

  const destinationDepth =
    destination.parentId === null
      ? 0
      : getTaskDepth(project, destination.parentId);
  if (destinationDepth === undefined) {
    return failure('PARENT_NOT_FOUND');
  }

  if (destinationDepth + getSubtreeHeight(project, taskId) > maximumTaskDepth) {
    return failure('MAX_DEPTH_EXCEEDED');
  }

  const sourceTaskIds =
    sourceParent === undefined ? project.rootTaskIds : sourceParent.childIds;
  const sourceIndex = sourceTaskIds.indexOf(taskId);
  if (sourceIndex === -1) {
    return failure('INVALID_INDEX');
  }

  const detachedSourceTaskIds = removeTaskId(sourceTaskIds, taskId);
  const sameContainer = task.parentId === destination.parentId;
  const destinationTaskIds =
    destinationParent === undefined
      ? project.rootTaskIds
      : destinationParent.childIds;
  const targetTaskIds = sameContainer
    ? detachedSourceTaskIds
    : destinationTaskIds;
  const maximumDestinationIndex = sameContainer
    ? sourceTaskIds.length
    : targetTaskIds.length;

  if (
    !Number.isInteger(destination.index) ||
    destination.index < 0 ||
    destination.index > maximumDestinationIndex
  ) {
    return failure('INVALID_INDEX');
  }

  const insertionIndex =
    sameContainer && sourceIndex < destination.index
      ? destination.index - 1
      : destination.index;
  const insertedTaskIds = insertTaskId(targetTaskIds, taskId, insertionIndex);
  let nextTasks: Record<TaskId, PlanTask> | undefined;
  const updateTaskRecord = (updatedTask: PlanTask): void => {
    nextTasks ??= { ...project.tasks };

    nextTasks[updatedTask.id] = updatedTask;
  };

  let nextRootTaskIds = project.rootTaskIds;

  if (sameContainer) {
    if (destinationParent === undefined) {
      nextRootTaskIds = insertedTaskIds;
    } else {
      updateTaskRecord({ ...destinationParent, childIds: insertedTaskIds });
    }
  } else {
    if (sourceParent === undefined) {
      nextRootTaskIds = detachedSourceTaskIds;
    } else {
      updateTaskRecord({ ...sourceParent, childIds: detachedSourceTaskIds });
    }

    if (destinationParent === undefined) {
      nextRootTaskIds = insertedTaskIds;
    } else {
      updateTaskRecord({ ...destinationParent, childIds: insertedTaskIds });
    }

    updateTaskRecord({ ...task, parentId: destination.parentId });
  }

  return success({
    ...project,
    rootTaskIds: nextRootTaskIds,
    tasks: nextTasks ?? project.tasks,
  });
};

export const updateTask = (
  project: Project,
  taskId: TaskId,
  update: TaskUpdate,
): Result<Project, 'TASK_NOT_FOUND'> => {
  const task = project.tasks[taskId];

  if (task === undefined) {
    return failure('TASK_NOT_FOUND');
  }

  return success({
    ...project,
    tasks: {
      ...project.tasks,
      [taskId]: { ...task, ...update },
    },
  });
};

export const deleteTask = (
  project: Project,
  taskId: TaskId,
): Result<Project, 'TASK_NOT_FOUND'> => {
  const task = project.tasks[taskId];

  if (task === undefined) {
    return failure('TASK_NOT_FOUND');
  }

  const removedTaskIds = collectSubtreeTaskIds(project, taskId);
  const nextTasks: Record<TaskId, PlanTask> = {};
  for (const candidateTask of Object.values(project.tasks)) {
    if (!removedTaskIds.has(candidateTask.id)) {
      nextTasks[candidateTask.id] = candidateTask;
    }
  }

  const parent = getParentTask(project, task.parentId);
  const nextRootTaskIds =
    task.parentId === null
      ? removeTaskId(project.rootTaskIds, taskId)
      : project.rootTaskIds;

  if (parent !== undefined) {
    nextTasks[parent.id] = {
      ...parent,
      childIds: removeTaskId(parent.childIds, taskId),
    };
  }

  const nextDependencies = project.dependencies.filter(
    ({ blockerId, blockedId }) =>
      !removedTaskIds.has(blockerId) && !removedTaskIds.has(blockedId),
  );

  return success({
    ...project,
    rootTaskIds: nextRootTaskIds,
    tasks: nextTasks,
    dependencies:
      nextDependencies.length === project.dependencies.length
        ? project.dependencies
        : nextDependencies,
  });
};
