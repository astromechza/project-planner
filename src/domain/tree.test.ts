import { describe, expect, it } from 'vitest';
import type { Result } from './result';
import { createEmptyProject } from './project';
import {
  addTask,
  deleteTask,
  moveTask,
  updateTask,
  type TreeError,
} from './tree';
import type { Dependency, PlanTask, Project, TaskId } from './types';

const id = (value: string): TaskId => value as TaskId;

const task = (
  taskId: TaskId,
  parentId: TaskId | null,
  childIds: readonly TaskId[] = [],
): PlanTask => ({
  id: taskId,
  title: taskId,
  parentId,
  childIds,
});

const project = (
  rootTaskIds: readonly TaskId[],
  tasks: Readonly<Record<TaskId, PlanTask>>,
  dependencies: readonly Dependency[] = [],
): Project => ({
  format: 'project-planner/v1',
  name: 'Health Hub plan',
  rootTaskIds,
  tasks,
  dependencies,
});

const expectSuccess = <T, E extends string>(result: Result<T, E>): T => {
  if (!result.ok) {
    throw new Error(`Expected success, received ${result.error}`);
  }

  return result.value;
};

const expectError = <T>(
  result: Result<T, TreeError>,
  error: TreeError,
): void => {
  expect(result).toEqual({ ok: false, error });
};

describe('immutable task tree operations', () => {
  it('adds a root initiative and a child epic', () => {
    const root = expectSuccess(
      addTask(createEmptyProject('Health Hub plan'), null, 'Deliver'),
    );
    const child = expectSuccess(
      addTask(root.project, root.task.id, 'Baseline'),
    );

    expect(child.project.rootTaskIds).toEqual([root.task.id]);
    expect(child.project.tasks[root.task.id]).toMatchObject({
      parentId: null,
      childIds: [child.task.id],
    });
    expect(child.task).toMatchObject({
      title: 'Baseline',
      parentId: root.task.id,
      childIds: [],
    });
  });

  it('inserts a root task at its requested index', () => {
    const first = id('first');
    const second = id('second');
    const initial = project([first, second], {
      [first]: task(first, null),
      [second]: task(second, null),
    });

    const added = expectSuccess(addTask(initial, null, 'Inserted', 1));

    expect(added.project.rootTaskIds).toEqual([first, added.task.id, second]);
  });

  it('inserts a child task at its requested index', () => {
    const initiative = id('initiative');
    const first = id('first');
    const second = id('second');
    const initial = project([initiative], {
      [initiative]: task(initiative, null, [first, second]),
      [first]: task(first, initiative),
      [second]: task(second, initiative),
    });

    const added = expectSuccess(addTask(initial, initiative, 'Inserted', 1));

    expect(added.project.tasks[initiative]?.childIds).toEqual([
      first,
      added.task.id,
      second,
    ]);
  });

  it('rejects invalid task-addition indexes', () => {
    const initiative = id('initiative');
    const initial = project([initiative], {
      [initiative]: task(initiative, null),
    });

    expectError(addTask(initial, null, 'Before start', -1), 'INVALID_INDEX');
    expectError(addTask(initial, null, 'Past end', 2), 'INVALID_INDEX');
    expectError(addTask(initial, initiative, 'Fraction', 0.5), 'INVALID_INDEX');
  });

  it('rejects adding a sixth hierarchy level', () => {
    let currentProject = createEmptyProject('Health Hub plan');
    let parentId: TaskId | null = null;

    for (const title of ['Initiative', 'Epic', 'Story', 'Task', 'Subtask']) {
      const added: { readonly project: Project; readonly task: PlanTask } =
        expectSuccess(addTask(currentProject, parentId, title));
      currentProject = added.project;
      parentId = added.task.id;
    }

    expectError(
      addTask(currentProject, parentId, 'Too deep'),
      'MAX_DEPTH_EXCEEDED',
    );
  });

  it('moves a root after its resolved target without changing its children', () => {
    const first = id('first');
    const child = id('child');
    const second = id('second');
    const initial = project([first, second], {
      [first]: task(first, null, [child]),
      [child]: task(child, first),
      [second]: task(second, null),
    });

    const moved = expectSuccess(
      moveTask(initial, first, { parentId: null, index: 2 }),
    );

    expect(moved.rootTaskIds).toEqual([second, first]);
    expect(moved.tasks[first]).toMatchObject({
      parentId: null,
      childIds: [child],
    });
    expect(moved.tasks[child]).toEqual(initial.tasks[child]);
  });

  it('rejects reparenting a task beneath one of its descendants', () => {
    const initiative = id('initiative');
    const epic = id('epic');
    const initial = project([initiative], {
      [initiative]: task(initiative, null, [epic]),
      [epic]: task(epic, initiative),
    });

    expectError(
      moveTask(initial, initiative, { parentId: epic, index: 0 }),
      'CYCLE',
    );
  });

  it('supports Tab mapping by moving a task under its preceding sibling', () => {
    const initiative = id('initiative');
    const epic = id('epic');
    const initial = project([initiative, epic], {
      [initiative]: task(initiative, null),
      [epic]: task(epic, null),
    });

    const moved = expectSuccess(
      moveTask(initial, epic, { parentId: initiative, index: 0 }),
    );

    expect(moved.rootTaskIds).toEqual([initiative]);
    expect(moved.tasks[initiative]?.childIds).toEqual([epic]);
    expect(moved.tasks[epic]?.parentId).toBe(initiative);
  });

  it('supports Shift+Tab mapping by moving a child after its parent', () => {
    const initiative = id('initiative');
    const epic = id('epic');
    const story = id('story');
    const initial = project([initiative], {
      [initiative]: task(initiative, null, [epic]),
      [epic]: task(epic, initiative, [story]),
      [story]: task(story, epic),
    });

    const moved = expectSuccess(
      moveTask(initial, story, { parentId: initiative, index: 1 }),
    );

    expect(moved.tasks[initiative]?.childIds).toEqual([epic, story]);
    expect(moved.tasks[epic]?.childIds).toEqual([]);
    expect(moved.tasks[story]?.parentId).toBe(initiative);
  });

  it('deletes a subtree and all dependency edges incident to it', () => {
    const initiative = id('initiative');
    const epic = id('epic');
    const outside = id('outside');
    const other = id('other');
    const initial = project(
      [initiative, outside, other],
      {
        [initiative]: task(initiative, null, [epic]),
        [epic]: task(epic, initiative),
        [outside]: task(outside, null),
        [other]: task(other, null),
      },
      [
        { blockerId: initiative, blockedId: outside },
        { blockerId: outside, blockedId: epic },
        { blockerId: outside, blockedId: other },
      ],
    );

    const deleted = expectSuccess(deleteTask(initial, initiative));

    expect(deleted.rootTaskIds).toEqual([outside, other]);
    expect(deleted.tasks[initiative]).toBeUndefined();
    expect(deleted.tasks[epic]).toBeUndefined();
    expect(deleted.dependencies).toEqual([
      { blockerId: outside, blockedId: other },
    ]);
  });

  it('updates a task without changing its tree position', () => {
    const initiative = id('initiative');
    const initial = project([initiative], {
      [initiative]: task(initiative, null),
    });

    const updated = expectSuccess(
      updateTask(initial, initiative, {
        title: 'Renamed',
        notes: 'Planning note',
        storyPoints: 7,
      }),
    );

    expect(updated.tasks[initiative]).toEqual({
      ...initial.tasks[initiative],
      title: 'Renamed',
      notes: 'Planning note',
      storyPoints: 7,
    });
    expect(updated.rootTaskIds).toBe(initial.rootTaskIds);
  });

  it('reports missing task and parent identifiers without changing the project', () => {
    const initiative = id('initiative');
    const initial = project([initiative], {
      [initiative]: task(initiative, null),
    });

    expectError(
      addTask(initial, id('missing-parent'), 'Child'),
      'PARENT_NOT_FOUND',
    );
    expectError(
      moveTask(initial, id('missing-task'), { parentId: null, index: 0 }),
      'TASK_NOT_FOUND',
    );
    expectError(
      moveTask(initial, initiative, {
        parentId: id('missing-parent'),
        index: 0,
      }),
      'PARENT_NOT_FOUND',
    );
    expect(
      updateTask(initial, id('missing-task'), { title: 'Missing' }),
    ).toEqual({
      ok: false,
      error: 'TASK_NOT_FOUND',
    });
    expect(deleteTask(initial, id('missing-task'))).toEqual({
      ok: false,
      error: 'TASK_NOT_FOUND',
    });
  });

  it('rejects invalid insertion indexes in the source container', () => {
    const initiative = id('initiative');
    const epic = id('epic');
    const initial = project([initiative, epic], {
      [initiative]: task(initiative, null),
      [epic]: task(epic, null),
    });

    expectError(
      moveTask(initial, initiative, { parentId: null, index: 3 }),
      'INVALID_INDEX',
    );
    expectError(
      moveTask(initial, initiative, { parentId: null, index: 0.5 }),
      'INVALID_INDEX',
    );
  });

  it('rejects a move that would make a subtree deeper than five levels', () => {
    const root = id('root');
    const child = id('child');
    const grandchild = id('grandchild');
    const targetRoot = id('target-root');
    const targetChild = id('target-child');
    const targetGrandchild = id('target-grandchild');
    const initial = project([root, targetRoot], {
      [root]: task(root, null, [child]),
      [child]: task(child, root, [grandchild]),
      [grandchild]: task(grandchild, child),
      [targetRoot]: task(targetRoot, null, [targetChild]),
      [targetChild]: task(targetChild, targetRoot, [targetGrandchild]),
      [targetGrandchild]: task(targetGrandchild, targetChild),
    });

    expectError(
      moveTask(initial, root, { parentId: targetGrandchild, index: 0 }),
      'MAX_DEPTH_EXCEEDED',
    );
  });

  it('moves a child to the root and removes it from its former parent', () => {
    const initiative = id('initiative');
    const epic = id('epic');
    const initial = project([initiative], {
      [initiative]: task(initiative, null, [epic]),
      [epic]: task(epic, initiative),
    });

    const moved = expectSuccess(
      moveTask(initial, epic, { parentId: null, index: 1 }),
    );

    expect(moved.rootTaskIds).toEqual([initiative, epic]);
    expect(moved.tasks[initiative]?.childIds).toEqual([]);
    expect(moved.tasks[epic]?.parentId).toBeNull();
  });

  it('moves a root backward using its source-container index', () => {
    const first = id('first');
    const second = id('second');
    const initial = project([first, second], {
      [first]: task(first, null),
      [second]: task(second, null),
    });

    const moved = expectSuccess(
      moveTask(initial, second, { parentId: null, index: 0 }),
    );

    expect(moved.rootTaskIds).toEqual([second, first]);
  });

  it('preserves root order for a no-op source-container move', () => {
    const first = id('first');
    const second = id('second');
    const initial = project([first, second], {
      [first]: task(first, null),
      [second]: task(second, null),
    });

    const moved = expectSuccess(
      moveTask(initial, first, { parentId: null, index: 0 }),
    );

    expect(moved.rootTaskIds).toEqual([first, second]);
  });

  it('reorders siblings within their existing parent', () => {
    const initiative = id('initiative');
    const firstEpic = id('first-epic');
    const secondEpic = id('second-epic');
    const initial = project([initiative], {
      [initiative]: task(initiative, null, [firstEpic, secondEpic]),
      [firstEpic]: task(firstEpic, initiative),
      [secondEpic]: task(secondEpic, initiative),
    });

    const moved = expectSuccess(
      moveTask(initial, secondEpic, { parentId: initiative, index: 0 }),
    );

    expect(moved.tasks[initiative]?.childIds).toEqual([secondEpic, firstEpic]);
    expect(moved.tasks[secondEpic]).toBe(initial.tasks[secondEpic]);
  });

  it('moves a sibling after its resolved target using a source-container index', () => {
    const initiative = id('initiative');
    const firstEpic = id('first-epic');
    const secondEpic = id('second-epic');
    const initial = project([initiative], {
      [initiative]: task(initiative, null, [firstEpic, secondEpic]),
      [firstEpic]: task(firstEpic, initiative),
      [secondEpic]: task(secondEpic, initiative),
    });

    const moved = expectSuccess(
      moveTask(initial, firstEpic, { parentId: initiative, index: 2 }),
    );

    expect(moved.tasks[initiative]?.childIds).toEqual([secondEpic, firstEpic]);
  });

  it('preserves sibling order for a no-op source-container move', () => {
    const initiative = id('initiative');
    const firstEpic = id('first-epic');
    const secondEpic = id('second-epic');
    const initial = project([initiative], {
      [initiative]: task(initiative, null, [firstEpic, secondEpic]),
      [firstEpic]: task(firstEpic, initiative),
      [secondEpic]: task(secondEpic, initiative),
    });

    const moved = expectSuccess(
      moveTask(initial, firstEpic, { parentId: initiative, index: 0 }),
    );

    expect(moved.tasks[initiative]?.childIds).toEqual([firstEpic, secondEpic]);
  });

  it('deletes a child from its parent while preserving unrelated edges', () => {
    const initiative = id('initiative');
    const epic = id('epic');
    const outside = id('outside');
    const initial = project(
      [initiative, outside],
      {
        [initiative]: task(initiative, null, [epic]),
        [epic]: task(epic, initiative),
        [outside]: task(outside, null),
      },
      [{ blockerId: initiative, blockedId: outside }],
    );

    const deleted = expectSuccess(deleteTask(initial, epic));

    expect(deleted.rootTaskIds).toBe(initial.rootTaskIds);
    expect(deleted.tasks[initiative]?.childIds).toEqual([]);
    expect(deleted.dependencies).toBe(initial.dependencies);
  });
});
