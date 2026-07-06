import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../domain/project';
import type { Project, TaskId } from '../domain/types';
import { createInitialAppState, projectReducer } from './projectReducer';

const initiativeId = 'initiative-1' as TaskId;

const projectWithInitiative = (): Project => ({
  format: 'project-planner/v1',
  name: 'Health Hub plan',
  rootTaskIds: [initiativeId],
  tasks: {
    [initiativeId]: {
      id: initiativeId,
      title: 'Deliver Health Hub',
      parentId: null,
      childIds: [],
    },
  },
  dependencies: [],
});

describe('projectReducer', () => {
  it('selects a task and clears an earlier error', () => {
    const state = {
      ...createInitialAppState(projectWithInitiative()),
      error: 'Previous problem',
    };

    expect(
      projectReducer(state, { type: 'select', taskId: initiativeId }),
    ).toMatchObject({ selectedTaskId: initiativeId, error: null });
  });

  it('creates and selects a root initiative', () => {
    const nextState = projectReducer(
      createInitialAppState(createEmptyProject('Plan')),
      {
        type: 'create',
        parentId: null,
        title: 'Deliver Health Hub',
      },
    );

    expect(nextState.error).toBeNull();
    expect(nextState.selectedTaskId).not.toBeNull();
    expect(nextState.project.rootTaskIds).toEqual([nextState.selectedTaskId]);
    expect(nextState.selectedTaskId).not.toBeNull();
    if (nextState.selectedTaskId === null) {
      throw new Error('Expected the new task to be selected');
    }
    expect(nextState.project.tasks[nextState.selectedTaskId]?.title).toBe(
      'Deliver Health Hub',
    );
  });

  it('updates a selected task title', () => {
    const nextState = projectReducer(
      createInitialAppState(projectWithInitiative()),
      {
        type: 'update',
        taskId: initiativeId,
        update: { title: 'Deliver multi-tenant Health Hub' },
      },
    );

    expect(nextState.project.tasks[initiativeId]?.title).toBe(
      'Deliver multi-tenant Health Hub',
    );
    expect(nextState.error).toBeNull();
  });

  it('updates and clears selected task story points', () => {
    const initialState = createInitialAppState(projectWithInitiative());
    const assigned = projectReducer(initialState, {
      type: 'update',
      taskId: initiativeId,
      update: { storyPoints: 7 },
    });

    expect(assigned.project.tasks[initiativeId]?.storyPoints).toBe(7);

    const cleared = projectReducer(assigned, {
      type: 'update',
      taskId: initiativeId,
      update: { storyPoints: undefined },
    });

    expect(cleared.project.tasks[initiativeId]?.storyPoints).toBeUndefined();
  });

  it('clears selection when deleting an ancestor of the selected task', () => {
    const epicId = 'epic-1' as TaskId;
    const baseProject = projectWithInitiative();
    const initiative = baseProject.tasks[initiativeId];
    if (initiative === undefined) {
      throw new Error('Expected the initiative to exist');
    }
    const project: Project = {
      ...baseProject,
      tasks: {
        [initiativeId]: {
          ...initiative,
          childIds: [epicId],
        },
        [epicId]: {
          id: epicId,
          title: 'Build the baseline',
          parentId: initiativeId,
          childIds: [],
        },
      },
    };

    const state = {
      ...createInitialAppState(project),
      selectedTaskId: epicId,
    };

    const nextState = projectReducer(state, {
      type: 'delete',
      taskId: initiativeId,
    });

    expect(nextState.selectedTaskId).toBeNull();
  });

  it('records a readable import error without replacing the project', () => {
    const currentProject = projectWithInitiative();
    const nextState = projectReducer(createInitialAppState(currentProject), {
      type: 'import failed',
      error: 'INVALID_JSON',
    });

    expect(nextState.project).toBe(currentProject);
    expect(nextState.error).toBe('Cannot import project: invalid JSON.');
  });
});
