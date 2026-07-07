import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import { serializeProjectFile } from './projectFile';
import type { Project, TaskId } from '../domain/types';

const schemaPath = resolve(process.cwd(), 'public/project-planner.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const validate = new Ajv2020().compile(schema);

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
      storyPoints: 5,
    },
  },
  dependencies: [{ blockerId: initiativeId, blockedId: epicId }],
};

const exported = (): unknown =>
  JSON.parse(
    serializeProjectFile(
      project,
      'https://plans.example/project-planner.schema.json',
    ),
  );

describe('project-planner.schema.json', () => {
  it('accepts a real export produced by the serializer', () => {
    expect(validate(exported())).toBe(true);
  });

  it('rejects an unknown top-level key', () => {
    expect(validate({ ...(exported() as object), surprise: true })).toBe(false);
  });

  it('rejects an invalid story point value', () => {
    const bad = exported() as {
      tasks: Record<string, { storyPoints?: number }>;
    };
    bad.tasks['epic-1'].storyPoints = 2;

    expect(validate(bad)).toBe(false);
  });

  it('rejects a task missing its title', () => {
    const bad = exported() as { tasks: Record<string, { title?: string }> };
    delete bad.tasks['epic-1'].title;

    expect(validate(bad)).toBe(false);
  });

  it('rejects a wrong format constant', () => {
    expect(
      validate({ ...(exported() as object), format: 'project-planner/v2' }),
    ).toBe(false);
  });
});
