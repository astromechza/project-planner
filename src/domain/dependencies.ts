import type { Result } from './result';
import type { Project, TaskId } from './types';

export type DependencyError =
  'TASK_NOT_FOUND' | 'SELF_DEPENDENCY' | 'DUPLICATE_DEPENDENCY';

export const linkDependency = (
  project: Project,
  blockerId: TaskId,
  blockedId: TaskId,
): Result<Project, DependencyError> => {
  if (
    project.tasks[blockerId] === undefined ||
    project.tasks[blockedId] === undefined
  ) {
    return { ok: false, error: 'TASK_NOT_FOUND' };
  }

  if (blockerId === blockedId) {
    return { ok: false, error: 'SELF_DEPENDENCY' };
  }

  if (
    project.dependencies.some(
      (dependency) =>
        dependency.blockerId === blockerId &&
        dependency.blockedId === blockedId,
    )
  ) {
    return { ok: false, error: 'DUPLICATE_DEPENDENCY' };
  }

  return {
    ok: true,
    value: {
      ...project,
      dependencies: [
        ...project.dependencies,
        {
          blockerId,
          blockedId,
        },
      ],
    },
  };
};

export const unlinkDependency = (
  project: Project,
  blockerId: TaskId,
  blockedId: TaskId,
): Project => {
  const dependencies = project.dependencies.filter(
    (dependency) =>
      dependency.blockerId !== blockerId || dependency.blockedId !== blockedId,
  );

  if (dependencies.length === project.dependencies.length) {
    return project;
  }

  return { ...project, dependencies };
};

export const getBlocks = (
  project: Project,
  taskId: TaskId,
): readonly TaskId[] =>
  project.dependencies
    .filter((dependency) => dependency.blockerId === taskId)
    .map((dependency) => dependency.blockedId);

export const getBlockedBy = (
  project: Project,
  taskId: TaskId,
): readonly TaskId[] =>
  project.dependencies
    .filter((dependency) => dependency.blockedId === taskId)
    .map((dependency) => dependency.blockerId);

export const isTaskInDependencyCycle = (
  project: Project,
  taskId: TaskId,
): boolean => {
  if (project.tasks[taskId] === undefined) {
    return false;
  }

  const visited = new Set<TaskId>([taskId]);

  const canReachTask = (currentTaskId: TaskId): boolean => {
    for (const blockedId of getBlocks(project, currentTaskId)) {
      if (blockedId === taskId) {
        return true;
      }

      if (project.tasks[blockedId] !== undefined && !visited.has(blockedId)) {
        visited.add(blockedId);

        if (canReachTask(blockedId)) {
          return true;
        }
      }
    }

    return false;
  };

  return canReachTask(taskId);
};

export const findDependencyCycles = (
  project: Project,
): readonly (readonly TaskId[])[] => {
  const cycles = new Map<string, readonly TaskId[]>();

  const canonicalizeCycle = (cycle: readonly TaskId[]): readonly TaskId[] => {
    const nodes = cycle.slice(0, -1);
    let startIndex = 0;

    for (let index = 1; index < nodes.length; index += 1) {
      const candidate = nodes[index];
      const currentStart = nodes[startIndex];

      if (
        candidate !== undefined &&
        currentStart !== undefined &&
        candidate < currentStart
      ) {
        startIndex = index;
      }
    }

    const canonicalNodes = [
      ...nodes.slice(startIndex),
      ...nodes.slice(0, startIndex),
    ];
    const firstNode = canonicalNodes[0];

    return firstNode === undefined ? [] : [...canonicalNodes, firstNode];
  };

  const addCycle = (cycle: readonly TaskId[]): void => {
    const canonicalCycle = canonicalizeCycle(cycle);
    cycles.set(JSON.stringify(canonicalCycle), canonicalCycle);
  };

  const getValidBlocks = (taskId: TaskId): readonly TaskId[] =>
    getBlocks(project, taskId).filter(
      (blockedId) => project.tasks[blockedId] !== undefined,
    );

  const findCyclesFrom = (startTaskId: TaskId): void => {
    const activePath: TaskId[] = [];
    const activeTasks = new Set<TaskId>();

    const visit = (taskId: TaskId): void => {
      activeTasks.add(taskId);
      activePath.push(taskId);

      for (const blockedId of getValidBlocks(taskId)) {
        if (blockedId === startTaskId) {
          addCycle([...activePath, startTaskId]);
        } else if (!activeTasks.has(blockedId)) {
          visit(blockedId);
        }
      }

      activePath.pop();
      activeTasks.delete(taskId);
    };

    visit(startTaskId);
  };

  for (const taskId of Object.keys(project.tasks).sort() as TaskId[]) {
    findCyclesFrom(taskId);
  }

  return [...cycles.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([, cycle]) => cycle);
};
