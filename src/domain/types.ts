declare const taskIdBrand: unique symbol;

export type TaskId = string & {
  readonly [taskIdBrand]: 'TaskId';
};

export type TaskType = 'Initiative' | 'Epic' | 'Story' | 'Task' | 'Subtask';

export const STORY_POINT_OPTIONS = [1, 3, 5, 7, 14] as const;
export type StoryPoints = (typeof STORY_POINT_OPTIONS)[number];

export interface PlanTask {
  readonly id: TaskId;
  readonly title: string;
  readonly parentId: TaskId | null;
  readonly childIds: readonly TaskId[];
  readonly notes?: string;
  readonly storyPoints?: StoryPoints;
}

export interface Dependency {
  readonly blockerId: TaskId;
  readonly blockedId: TaskId;
}

export interface Project {
  readonly format: 'project-planner/v1';
  readonly name: string;
  readonly rootTaskIds: readonly TaskId[];
  readonly tasks: Readonly<Record<TaskId, PlanTask>>;
  readonly dependencies: readonly Dependency[];
}
