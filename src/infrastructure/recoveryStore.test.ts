import { describe, expect, it } from 'vitest';
import {
  RECOVERY_STORAGE_KEY,
  clearRecovery,
  loadRecovery,
  saveRecovery,
} from './recoveryStore';
import type { Project, TaskId } from '../domain/types';

class FakeStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

class ThrowingStorage implements Storage {
  readonly length = 0;

  clear(): void {
    throw new Error('Storage is unavailable');
  }

  getItem(): string | null {
    throw new Error('Storage is unavailable');
  }

  key(): string | null {
    throw new Error('Storage is unavailable');
  }

  removeItem(): void {
    throw new Error('Storage is unavailable');
  }

  setItem(): void {
    throw new Error('Storage is unavailable');
  }
}

const initiativeId = 'initiative-1' as TaskId;
const project: Project = {
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
};

describe('recovery store', () => {
  it('saves and loads a project with the versioned recovery key', () => {
    const storage = new FakeStorage();

    saveRecovery(storage, project);

    expect(RECOVERY_STORAGE_KEY).toBe('project-planner/recovery/v1');
    expect(storage.getItem(RECOVERY_STORAGE_KEY)).not.toBeNull();
    expect(loadRecovery(storage)).toEqual(project);
  });

  it('returns null when no recovery exists', () => {
    expect(loadRecovery(new FakeStorage())).toBeNull();
  });

  it('clears a saved recovery project', () => {
    const storage = new FakeStorage();
    saveRecovery(storage, project);

    clearRecovery(storage);

    expect(loadRecovery(storage)).toBeNull();
  });

  it('returns null without throwing for corrupt recovery text', () => {
    const storage = new FakeStorage();
    storage.setItem(RECOVERY_STORAGE_KEY, '{not valid json');

    expect(() => loadRecovery(storage)).not.toThrow();
    expect(loadRecovery(storage)).toBeNull();
  });

  it('returns null without throwing when storage cannot be read', () => {
    const storage = new ThrowingStorage();

    expect(() => loadRecovery(storage)).not.toThrow();
    expect(loadRecovery(storage)).toBeNull();
  });

  it('does not throw when storage cannot save recovery', () => {
    expect(() => {
      saveRecovery(new ThrowingStorage(), project);
    }).not.toThrow();
  });

  it('does not throw when storage cannot clear recovery', () => {
    expect(() => {
      clearRecovery(new ThrowingStorage());
    }).not.toThrow();
  });
});
