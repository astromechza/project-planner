import { afterEach, describe, expect, it, vi } from 'vitest';
import { projectSchemaUrl } from './schemaUrl';

describe('projectSchemaUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('joins the current origin, base path, and schema filename', () => {
    vi.stubGlobal('location', { origin: 'https://plans.example' });

    expect(projectSchemaUrl()).toBe(
      `https://plans.example${import.meta.env.BASE_URL}project-planner.schema.json`,
    );
  });

  it('produces no double slash between base and filename', () => {
    vi.stubGlobal('location', { origin: 'https://plans.example' });

    expect(projectSchemaUrl()).not.toMatch(/[^:]\/\/project-planner\.schema/);
  });
});
