import type { Project, TaskId, TaskType } from './types';

const taskTypesByDepth: readonly TaskType[] = [
  'Initiative',
  'Epic',
  'Story',
  'Task',
  'Subtask',
];

export const createEmptyProject = (name: string): Project => ({
  format: 'project-planner/v1',
  name,
  rootTaskIds: [],
  tasks: {},
  dependencies: [],
});

export const getTaskDepth = (
  project: Project,
  taskId: TaskId,
): number | undefined => {
  let currentTask = project.tasks[taskId];
  let depth = 0;
  const visited = new Set<TaskId>();

  while (currentTask !== undefined) {
    if (visited.has(currentTask.id)) {
      return undefined;
    }

    visited.add(currentTask.id);
    depth += 1;

    if (currentTask.parentId === null) {
      return depth;
    }

    currentTask = project.tasks[currentTask.parentId];
  }

  return undefined;
};

export const getTaskType = (
  project: Project,
  taskId: TaskId,
): TaskType | undefined => {
  const depth = getTaskDepth(project, taskId);

  if (depth === undefined || depth > taskTypesByDepth.length) {
    return undefined;
  }

  return taskTypesByDepth[depth - 1];
};
