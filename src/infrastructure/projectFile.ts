import type { Dependency, PlanTask, Project, TaskId } from '../domain/types';
import type { Result } from '../domain/result';
import { isStoryPoints } from '../domain/storyPoints';

export type ProjectFileError =
  'INVALID_JSON' | 'UNSUPPORTED_FORMAT' | 'INVALID_PROJECT';

type JsonObject = Record<string, unknown>;

const prototypeReservedTaskIds = new Set([
  '__proto__',
  'prototype',
  'constructor',
]);

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asTaskId = (value: unknown): TaskId | undefined =>
  typeof value === 'string' &&
  value.length > 0 &&
  !prototypeReservedTaskIds.has(value)
    ? (value as TaskId)
    : undefined;

const createTaskMap = (): Record<TaskId, PlanTask> =>
  Object.create(null) as Record<TaskId, PlanTask>;

const parseTaskIds = (value: unknown): readonly TaskId[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const taskIds: TaskId[] = [];
  for (const item of value) {
    const taskId = asTaskId(item);
    if (taskId === undefined || taskIds.includes(taskId)) {
      return undefined;
    }
    taskIds.push(taskId);
  }

  return taskIds;
};

const parseTask = (value: unknown): PlanTask | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const id = asTaskId(value.id);
  const childIds = parseTaskIds(value.childIds);
  if (
    id === undefined ||
    typeof value.title !== 'string' ||
    childIds === undefined ||
    (value.parentId !== null && asTaskId(value.parentId) === undefined) ||
    (value.notes !== undefined && typeof value.notes !== 'string') ||
    (value.storyPoints !== undefined && !isStoryPoints(value.storyPoints))
  ) {
    return undefined;
  }

  const parentId = value.parentId === null ? null : asTaskId(value.parentId);
  if (parentId === undefined) {
    return undefined;
  }

  return value.storyPoints === undefined
    ? value.notes === undefined
      ? { id, title: value.title, parentId, childIds }
      : { id, title: value.title, parentId, childIds, notes: value.notes }
    : {
        id,
        title: value.title,
        parentId,
        childIds,
        ...(value.notes === undefined ? {} : { notes: value.notes }),
        storyPoints: value.storyPoints,
      };
};

const parseTasks = (
  value: unknown,
): Readonly<Record<TaskId, PlanTask>> | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const tasks = createTaskMap();
  for (const [key, rawTask] of Object.entries(value)) {
    const taskId = asTaskId(key);
    const task = parseTask(rawTask);
    if (taskId === undefined || task?.id !== taskId) {
      return undefined;
    }
    tasks[taskId] = task;
  }

  return tasks;
};

const parseDependencies = (
  value: unknown,
): readonly Dependency[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const dependencies: Dependency[] = [];
  for (const rawDependency of value) {
    if (!isObject(rawDependency)) {
      return undefined;
    }

    const blockerId = asTaskId(rawDependency.blockerId);
    const blockedId = asTaskId(rawDependency.blockedId);
    if (blockerId === undefined || blockedId === undefined) {
      return undefined;
    }
    dependencies.push({ blockerId, blockedId });
  }

  return dependencies;
};

const hasTask = (
  tasks: Readonly<Record<TaskId, PlanTask>>,
  taskId: TaskId,
): boolean => Object.hasOwn(tasks, taskId);

const getTask = (
  tasks: Readonly<Record<TaskId, PlanTask>>,
  taskId: TaskId,
): PlanTask | undefined => (hasTask(tasks, taskId) ? tasks[taskId] : undefined);

const hasValidTaskReferences = (
  rootTaskIds: readonly TaskId[],
  tasks: Readonly<Record<TaskId, PlanTask>>,
  dependencies: readonly Dependency[],
): boolean => {
  const rootTaskIdSet = new Set(rootTaskIds);

  for (const taskId of rootTaskIds) {
    const task = getTask(tasks, taskId);
    if (task?.parentId !== null) {
      return false;
    }
  }

  for (const task of Object.values(tasks)) {
    if (task.parentId === null) {
      if (!rootTaskIdSet.has(task.id)) {
        return false;
      }
    } else {
      const parent = getTask(tasks, task.parentId);
      if (!parent?.childIds.includes(task.id)) {
        return false;
      }
    }

    for (const childId of task.childIds) {
      const child = getTask(tasks, childId);
      if (child?.parentId !== task.id) {
        return false;
      }
    }
  }

  const blockedTaskIdsByBlocker = new Map<TaskId, Set<TaskId>>();
  for (const { blockerId, blockedId } of dependencies) {
    if (
      blockerId === blockedId ||
      !hasTask(tasks, blockerId) ||
      !hasTask(tasks, blockedId)
    ) {
      return false;
    }

    const blockedTaskIds =
      blockedTaskIdsByBlocker.get(blockerId) ?? new Set<TaskId>();
    if (blockedTaskIds.has(blockedId)) {
      return false;
    }
    blockedTaskIds.add(blockedId);
    blockedTaskIdsByBlocker.set(blockerId, blockedTaskIds);
  }

  return true;
};

const hasValidHierarchyDepth = (
  tasks: Readonly<Record<TaskId, PlanTask>>,
): boolean => {
  for (const task of Object.values(tasks)) {
    const visitedTaskIds = new Set<TaskId>();
    let depth = 0;
    let currentTask: PlanTask | undefined = task;

    while (currentTask !== undefined) {
      if (visitedTaskIds.has(currentTask.id)) {
        return false;
      }
      visitedTaskIds.add(currentTask.id);
      depth += 1;
      if (depth > 5) {
        return false;
      }
      currentTask =
        currentTask.parentId === null
          ? undefined
          : getTask(tasks, currentTask.parentId);
    }
  }

  return true;
};

export const parseProjectFile = (
  serialized: string,
): Result<Project, ProjectFileError> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: 'INVALID_PROJECT' };
  }
  if (parsed.format !== 'project-planner/v1') {
    return { ok: false, error: 'UNSUPPORTED_FORMAT' };
  }
  if (typeof parsed.name !== 'string') {
    return { ok: false, error: 'INVALID_PROJECT' };
  }

  const rootTaskIds = parseTaskIds(parsed.rootTaskIds);
  const tasks = parseTasks(parsed.tasks);
  const dependencies = parseDependencies(parsed.dependencies);
  if (
    rootTaskIds === undefined ||
    tasks === undefined ||
    dependencies === undefined ||
    !hasValidTaskReferences(rootTaskIds, tasks, dependencies) ||
    !hasValidHierarchyDepth(tasks)
  ) {
    return { ok: false, error: 'INVALID_PROJECT' };
  }

  return {
    ok: true,
    value: {
      format: 'project-planner/v1',
      name: parsed.name,
      rootTaskIds,
      tasks,
      dependencies,
    },
  };
};

export const serializeProjectFile = (
  project: Project,
  schemaUrl: string,
): string =>
  JSON.stringify(
    {
      $schema: schemaUrl,
      format: project.format,
      name: project.name,
      rootTaskIds: project.rootTaskIds,
      tasks: project.tasks,
      dependencies: project.dependencies,
    },
    null,
    2,
  );
