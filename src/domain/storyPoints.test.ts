import { describe, expect, it } from 'vitest';
import { getStoryPointsTotal, isStoryPoints } from './storyPoints';
import type { PlanTask, Project, TaskId } from './types';

const id = (value: string): TaskId => value as TaskId;

const task = (
  taskId: string,
  parentId: TaskId | null,
  childIds: readonly TaskId[],
  storyPoints?: 1 | 3 | 5 | 7 | 14,
): PlanTask => ({
  id: id(taskId),
  title: taskId,
  parentId,
  childIds,
  ...(storyPoints === undefined ? {} : { storyPoints }),
});

describe('story points', () => {
  it.each([1, 3, 5, 7, 14])('accepts %d as a story-point value', (value) => {
    expect(isStoryPoints(value)).toBe(true);
  });

  it.each([0, 2, 6, 8, 15, '5', null])(
    'rejects %p as a story-point value',
    (value) => {
      expect(isStoryPoints(value)).toBe(false);
    },
  );

  it('sums the selected task and all descendants once', () => {
    const root = id('root');
    const child = id('child');
    const grandchild = id('grandchild');
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Points',
      rootTaskIds: [root],
      tasks: {
        [root]: task('root', null, [child], 3),
        [child]: task('child', root, [grandchild], 5),
        [grandchild]: task('grandchild', child, [], 14),
      },
      dependencies: [],
    };

    expect(getStoryPointsTotal(project, root)).toBe(22);
    expect(getStoryPointsTotal(project, child)).toBe(19);
  });

  it('ignores missing tasks and cyclic descendants', () => {
    const root = id('root');
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Points',
      rootTaskIds: [root],
      tasks: {
        [root]: task('root', null, [root, id('missing')], 1),
      },
      dependencies: [],
    };

    expect(getStoryPointsTotal(project, root)).toBe(1);
    expect(getStoryPointsTotal(project, id('missing'))).toBe(0);
  });
});
