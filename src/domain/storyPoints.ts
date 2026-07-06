import type { Project, StoryPoints, TaskId } from './types';

export const isStoryPoints = (value: unknown): value is StoryPoints =>
  value === 1 || value === 3 || value === 5 || value === 7 || value === 14;

export const getStoryPointsTotal = (
  project: Project,
  taskId: TaskId,
  visited = new Set<TaskId>(),
): number => {
  if (visited.has(taskId)) {
    return 0;
  }

  const task = project.tasks[taskId];
  if (task === undefined) {
    return 0;
  }

  visited.add(taskId);
  return (
    (task.storyPoints ?? 0) +
    task.childIds.reduce(
      (total, childId) =>
        total + getStoryPointsTotal(project, childId, visited),
      0,
    )
  );
};
