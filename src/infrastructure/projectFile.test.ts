import { describe, expect, it } from 'vitest';
import { parseProjectFile, serializeProjectFile } from './projectFile';
import type { Project, TaskId } from '../domain/types';

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
      notes: 'Start with the parent POM.',
    },
  },
  dependencies: [{ blockerId: initiativeId, blockedId: epicId }],
};

describe('project files', () => {
  it('round-trips a valid project', () => {
    const serialized = serializeProjectFile(project);

    expect(parseProjectFile(serialized)).toEqual({ ok: true, value: project });
  });

  it('serializes projects deterministically in the documented field order', () => {
    expect(serializeProjectFile(project)).toBe(`{
  "format": "project-planner/v1",
  "name": "Health Hub plan",
  "rootTaskIds": [
    "initiative-1"
  ],
  "tasks": {
    "initiative-1": {
      "id": "initiative-1",
      "title": "Deliver Health Hub",
      "parentId": null,
      "childIds": [
        "epic-1"
      ]
    },
    "epic-1": {
      "id": "epic-1",
      "title": "Build the baseline",
      "parentId": "initiative-1",
      "childIds": [],
      "notes": "Start with the parent POM."
    }
  },
  "dependencies": [
    {
      "blockerId": "initiative-1",
      "blockedId": "epic-1"
    }
  ]
}`);
  });

  it('rejects invalid JSON', () => {
    expect(parseProjectFile('{')).toEqual({ ok: false, error: 'INVALID_JSON' });
  });

  it('rejects a JSON value that is not a project object', () => {
    expect(parseProjectFile('[]')).toEqual({
      ok: false,
      error: 'INVALID_PROJECT',
    });
  });

  it('rejects an unsupported project format', () => {
    expect(
      parseProjectFile(
        JSON.stringify({ ...project, format: 'project-planner/v2' }),
      ),
    ).toEqual({ ok: false, error: 'UNSUPPORTED_FORMAT' });
  });

  it('rejects a structurally invalid project', () => {
    expect(
      parseProjectFile(
        JSON.stringify({
          ...project,
          dependencies: [{ blockerId: initiativeId }],
        }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects a root task ID that is not present in the task map', () => {
    expect(
      parseProjectFile(
        JSON.stringify({ ...project, rootTaskIds: ['missing-task'] }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects a root task omitted from rootTaskIds', () => {
    expect(
      parseProjectFile(JSON.stringify({ ...project, rootTaskIds: [] })),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects a dependency that references a missing task', () => {
    expect(
      parseProjectFile(
        JSON.stringify({
          ...project,
          dependencies: [
            { blockerId: initiativeId, blockedId: 'missing-task' },
          ],
        }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects a non-array dependency list', () => {
    expect(
      parseProjectFile(JSON.stringify({ ...project, dependencies: {} })),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects non-string task notes', () => {
    const invalidTasks = {
      ...project.tasks,
      [epicId]: { ...project.tasks[epicId], notes: 42 },
    };

    expect(
      parseProjectFile(JSON.stringify({ ...project, tasks: invalidTasks })),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('round-trips assigned story points and preserves legacy tasks without them', () => {
    const projectWithPoints: Project = {
      ...project,
      tasks: {
        ...project.tasks,
        [initiativeId]: { ...project.tasks[initiativeId], storyPoints: 14 },
      },
    };

    expect(parseProjectFile(serializeProjectFile(projectWithPoints))).toEqual({
      ok: true,
      value: projectWithPoints,
    });
    expect(parseProjectFile(serializeProjectFile(project))).toEqual({
      ok: true,
      value: project,
    });
  });

  it.each([0, 2, 6, 8, 15, '5'])(
    'rejects invalid task story points %p',
    (value) => {
      const invalidTasks = {
        ...project.tasks,
        [epicId]: { ...project.tasks[epicId], storyPoints: value },
      };

      expect(
        parseProjectFile(JSON.stringify({ ...project, tasks: invalidTasks })),
      ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
    },
  );

  it('rejects a task whose map key does not match its id', () => {
    const invalidTasks = {
      [initiativeId]: project.tasks[initiativeId],
      'wrong-key': project.tasks[epicId],
    };

    expect(
      parseProjectFile(JSON.stringify({ ...project, tasks: invalidTasks })),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it.each(['__proto__', 'prototype', 'constructor'])(
    'rejects prototype-reserved task ID %s',
    (taskId) => {
      expect(
        parseProjectFile(
          JSON.stringify({
            format: 'project-planner/v1',
            name: 'Prototype task',
            rootTaskIds: [taskId],
            tasks: {
              [taskId]: {
                id: taskId,
                title: 'Prototype task',
                parentId: null,
                childIds: [],
              },
            },
            dependencies: [],
          }),
        ),
      ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
    },
  );

  it('rejects a dependency endpoint inherited from Object.prototype', () => {
    expect(
      parseProjectFile(
        JSON.stringify({
          ...project,
          dependencies: [{ blockerId: 'toString', blockedId: initiativeId }],
        }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects a self dependency', () => {
    expect(
      parseProjectFile(
        JSON.stringify({
          ...project,
          dependencies: [{ blockerId: initiativeId, blockedId: initiativeId }],
        }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects duplicate dependency edges', () => {
    expect(
      parseProjectFile(
        JSON.stringify({
          ...project,
          dependencies: [
            { blockerId: initiativeId, blockedId: epicId },
            { blockerId: initiativeId, blockedId: epicId },
          ],
        }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects a parent-child mismatch', () => {
    const invalidTasks = {
      ...project.tasks,
      [epicId]: { ...project.tasks[epicId], parentId: null },
    };

    expect(
      parseProjectFile(JSON.stringify({ ...project, tasks: invalidTasks })),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects hierarchy depths beyond a subtask', () => {
    const taskIds = [
      'initiative',
      'epic',
      'story',
      'task',
      'subtask',
      'too-deep',
    ];
    const tasks = Object.fromEntries(
      taskIds.map((id, index) => [
        id,
        {
          id,
          title: id,
          parentId: index === 0 ? null : taskIds[index - 1],
          childIds: index === taskIds.length - 1 ? [] : [taskIds[index + 1]],
        },
      ]),
    );

    expect(
      parseProjectFile(
        JSON.stringify({
          format: 'project-planner/v1',
          name: 'Too deep',
          rootTaskIds: [taskIds[0]],
          tasks,
          dependencies: [],
        }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });

  it('rejects a cyclic parent hierarchy', () => {
    expect(
      parseProjectFile(
        JSON.stringify({
          format: 'project-planner/v1',
          name: 'Cycle',
          rootTaskIds: [],
          tasks: {
            first: {
              id: 'first',
              title: 'First',
              parentId: 'second',
              childIds: ['second'],
            },
            second: {
              id: 'second',
              title: 'Second',
              parentId: 'first',
              childIds: ['first'],
            },
          },
          dependencies: [],
        }),
      ),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });
});
