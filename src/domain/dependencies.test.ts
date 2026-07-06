import { describe, expect, it } from 'vitest';
import {
  findDependencyCycles,
  getBlockedBy,
  getBlocks,
  isTaskInDependencyCycle,
  linkDependency,
  unlinkDependency,
  type DependencyError,
} from './dependencies';
import type { Result } from './result';
import type { Dependency, PlanTask, Project, TaskId } from './types';

const id = (value: string): TaskId => value as TaskId;

const task = (taskId: TaskId): PlanTask => ({
  id: taskId,
  title: taskId,
  parentId: null,
  childIds: [],
});

const tasksFor = (
  taskIds: readonly TaskId[],
): Readonly<Record<TaskId, PlanTask>> => {
  const tasks: Record<TaskId, PlanTask> = {};

  for (const taskId of taskIds) {
    tasks[taskId] = task(taskId);
  }

  return tasks;
};

const project = (
  taskIds: readonly TaskId[],
  dependencies: Project['dependencies'] = [],
): Project => ({
  format: 'project-planner/v1',
  name: 'Health Hub plan',
  rootTaskIds: taskIds,
  tasks: tasksFor(taskIds),
  dependencies,
});

const expectSuccess = <T, E extends string>(result: Result<T, E>): T => {
  if (!result.ok) {
    throw new Error(`Expected success, received ${result.error}`);
  }

  return result.value;
};

const expectError = (
  result: Result<Project, DependencyError>,
  error: DependencyError,
): void => {
  expect(result).toEqual({ ok: false, error });
};

describe('blocker dependency operations', () => {
  it('links an existing blocker to an existing blocked task immutably', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const initial = project([alpha, beta]);

    const linked = expectSuccess(linkDependency(initial, alpha, beta));

    expect(linked.dependencies).toEqual([
      { blockerId: alpha, blockedId: beta },
    ]);
    expect(linked).not.toBe(initial);
    expect(initial.dependencies).toEqual([]);
  });

  it('rejects links whose blocker or blocked task is absent', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const initial = project([alpha]);

    expectError(linkDependency(initial, beta, alpha), 'TASK_NOT_FOUND');
    expectError(linkDependency(initial, alpha, beta), 'TASK_NOT_FOUND');
  });

  it('rejects a task blocking itself', () => {
    const alpha = id('alpha');

    expectError(
      linkDependency(project([alpha]), alpha, alpha),
      'SELF_DEPENDENCY',
    );
  });

  it('rejects duplicate blocker relationships', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const initial = project(
      [alpha, beta],
      [{ blockerId: alpha, blockedId: beta }],
    );

    expectError(linkDependency(initial, alpha, beta), 'DUPLICATE_DEPENDENCY');
  });

  it('returns direct blockers and blocked tasks in dependency order', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const gamma = id('gamma');
    const delta = id('delta');
    const initial = project(
      [alpha, beta, gamma, delta],
      [
        { blockerId: alpha, blockedId: gamma },
        { blockerId: beta, blockedId: gamma },
        { blockerId: gamma, blockedId: delta },
      ],
    );

    expect(getBlockedBy(initial, gamma)).toEqual([alpha, beta]);
    expect(getBlocks(initial, gamma)).toEqual([delta]);
  });

  it('unlinks a dependency without mutating the original project', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const initial = project(
      [alpha, beta],
      [{ blockerId: alpha, blockedId: beta }],
    );

    const unlinked = unlinkDependency(initial, alpha, beta);

    expect(unlinked.dependencies).toEqual([]);
    expect(unlinked).not.toBe(initial);
    expect(initial.dependencies).toEqual([
      { blockerId: alpha, blockedId: beta },
    ]);
    expect(unlinkDependency(unlinked, alpha, beta)).toBe(unlinked);
  });

  it('finds a deterministic directed cycle that closes its path', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const initial = project(
      [alpha, beta],
      [
        { blockerId: alpha, blockedId: beta },
        { blockerId: beta, blockedId: alpha },
      ],
    );

    expect(findDependencyCycles(initial)).toEqual([[alpha, beta, alpha]]);
  });

  it('identifies tasks that are and are not members of a dependency cycle', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const gamma = id('gamma');
    const initial = project(
      [alpha, beta, gamma],
      [
        { blockerId: alpha, blockedId: beta },
        { blockerId: beta, blockedId: alpha },
        { blockerId: gamma, blockedId: alpha },
      ],
    );

    expect(isTaskInDependencyCycle(initial, alpha)).toBe(true);
    expect(isTaskInDependencyCycle(initial, beta)).toBe(true);
    expect(isTaskInDependencyCycle(initial, gamma)).toBe(false);
    expect(isTaskInDependencyCycle(initial, id('missing'))).toBe(false);
  });

  it('checks a task in a dense dependency graph without enumerating cycles', () => {
    const taskIds = Array.from({ length: 24 }, (_, index) =>
      id(`task-${String(index)}`),
    );
    const dependencies: Dependency[] = [];

    for (let index = 0; index < taskIds.length - 1; index += 1) {
      const taskId = taskIds[index];
      const nextTaskId = taskIds[index + 1];

      if (taskId !== undefined && nextTaskId !== undefined) {
        dependencies.push({ blockerId: taskId, blockedId: nextTaskId });
      }

      const skipTaskId = taskIds[index + 2];

      if (taskId !== undefined && skipTaskId !== undefined) {
        dependencies.push({ blockerId: taskId, blockedId: skipTaskId });
      }
    }

    const firstTaskId = taskIds[0];
    const cycleStart = taskIds[12];
    const lastTaskId = taskIds.at(-1);

    if (
      firstTaskId === undefined ||
      cycleStart === undefined ||
      lastTaskId === undefined
    ) {
      throw new Error('Expected dense test graph identifiers');
    }

    dependencies.push({ blockerId: lastTaskId, blockedId: cycleStart });
    const initial = project(taskIds, dependencies);

    expect(isTaskInDependencyCycle(initial, firstTaskId)).toBe(false);
    expect(isTaskInDependencyCycle(initial, cycleStart)).toBe(true);
    expect(isTaskInDependencyCycle(initial, lastTaskId)).toBe(true);
  });

  it('finds overlapping directed cycles with canonical, deterministic paths', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const gamma = id('gamma');
    const initial = project(
      [alpha, beta, gamma],
      [
        { blockerId: alpha, blockedId: beta },
        { blockerId: beta, blockedId: gamma },
        { blockerId: gamma, blockedId: alpha },
        { blockerId: alpha, blockedId: gamma },
      ],
    );

    expect(findDependencyCycles(initial)).toEqual([
      [alpha, beta, gamma, alpha],
      [alpha, gamma, alpha],
    ]);
  });

  it('deduplicates cycles and ignores corrupt edges to missing tasks', () => {
    const alpha = id('alpha');
    const beta = id('beta');
    const missing = id('missing');
    const initial = project(
      [alpha, beta],
      [
        { blockerId: alpha, blockedId: beta },
        { blockerId: alpha, blockedId: beta },
        { blockerId: beta, blockedId: alpha },
        { blockerId: alpha, blockedId: missing },
        { blockerId: missing, blockedId: alpha },
      ],
    );

    expect(findDependencyCycles(initial)).toEqual([[alpha, beta, alpha]]);
  });
});
