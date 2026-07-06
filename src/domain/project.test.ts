import { describe, expect, it } from 'vitest';
import { createEmptyProject, getTaskDepth, getTaskType } from './project';
import type { Project, TaskId } from './types';

describe('project domain model', () => {
  it('creates an empty v1 project', () => {
    expect(createEmptyProject('Health Hub plan')).toEqual({
      format: 'project-planner/v1',
      name: 'Health Hub plan',
      rootTaskIds: [],
      tasks: {},
      dependencies: [],
    });
  });

  it('derives depth one and Initiative for a root task', () => {
    const taskId = 'initiative-1' as TaskId;
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Health Hub plan',
      rootTaskIds: [taskId],
      tasks: {
        [taskId]: {
          id: taskId,
          title: 'Deliver Health Hub',
          parentId: null,
          childIds: [],
        },
      },
      dependencies: [],
    };

    expect(getTaskDepth(project, taskId)).toBe(1);
    expect(getTaskType(project, taskId)).toBe('Initiative');
  });

  it('walks parent IDs to derive a nested task type', () => {
    const initiativeId = 'initiative-1' as TaskId;
    const epicId = 'epic-1' as TaskId;
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Health Hub plan',
      rootTaskIds: [initiativeId],
      tasks: {
        [initiativeId]: {
          id: initiativeId,
          title: 'Deliver Health Hub',
          parentId: null,
          childIds: [epicId],
        },
        [epicId]: {
          id: epicId,
          title: 'Build the baseline',
          parentId: initiativeId,
          childIds: [],
        },
      },
      dependencies: [],
    };

    expect(getTaskDepth(project, epicId)).toBe(2);
    expect(getTaskType(project, epicId)).toBe('Epic');
  });

  it('returns undefined for an unknown task', () => {
    const project = createEmptyProject('Health Hub plan');

    expect(getTaskDepth(project, 'missing' as TaskId)).toBeUndefined();
    expect(getTaskType(project, 'missing' as TaskId)).toBeUndefined();
  });

  it('returns undefined for a cyclic parent chain', () => {
    const firstId = 'first' as TaskId;
    const secondId = 'second' as TaskId;
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Health Hub plan',
      rootTaskIds: [],
      tasks: {
        [firstId]: {
          id: firstId,
          title: 'First',
          parentId: secondId,
          childIds: [],
        },
        [secondId]: {
          id: secondId,
          title: 'Second',
          parentId: firstId,
          childIds: [],
        },
      },
      dependencies: [],
    };

    expect(getTaskDepth(project, firstId)).toBeUndefined();
  });

  it('does not derive a type beyond the fifth depth', () => {
    const taskIds = [
      'initiative',
      'epic',
      'story',
      'task',
      'subtask',
      'too-deep',
    ].map((id) => id as TaskId);
    const [initiativeId, epicId, storyId, taskId, subtaskId, tooDeepId] =
      taskIds;

    if (
      initiativeId === undefined ||
      epicId === undefined ||
      storyId === undefined ||
      taskId === undefined ||
      subtaskId === undefined ||
      tooDeepId === undefined
    ) {
      throw new Error('Expected six task IDs');
    }

    const project: Project = {
      format: 'project-planner/v1',
      name: 'Health Hub plan',
      rootTaskIds: [initiativeId],
      tasks: {
        [initiativeId]: {
          id: initiativeId,
          title: 'Initiative',
          parentId: null,
          childIds: [epicId],
        },
        [epicId]: {
          id: epicId,
          title: 'Epic',
          parentId: initiativeId,
          childIds: [storyId],
        },
        [storyId]: {
          id: storyId,
          title: 'Story',
          parentId: epicId,
          childIds: [taskId],
        },
        [taskId]: {
          id: taskId,
          title: 'Task',
          parentId: storyId,
          childIds: [subtaskId],
        },
        [subtaskId]: {
          id: subtaskId,
          title: 'Subtask',
          parentId: taskId,
          childIds: [tooDeepId],
        },
        [tooDeepId]: {
          id: tooDeepId,
          title: 'Invalid sixth level',
          parentId: subtaskId,
          childIds: [],
        },
      },
      dependencies: [],
    };

    expect(getTaskType(project, tooDeepId)).toBeUndefined();
  });
});
