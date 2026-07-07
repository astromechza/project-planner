import { parseProjectFile, serializeProjectFile } from './projectFile';
import { projectSchemaUrl } from './schemaUrl';
import type { Project } from '../domain/types';

export const RECOVERY_STORAGE_KEY = 'project-planner/recovery/v1';

export const loadRecovery = (storage: Storage): Project | null => {
  let serialized: string | null;
  try {
    serialized = storage.getItem(RECOVERY_STORAGE_KEY);
  } catch {
    return null;
  }

  if (serialized === null) {
    return null;
  }

  const result = parseProjectFile(serialized);
  return result.ok ? result.value : null;
};

export const saveRecovery = (storage: Storage, project: Project): void => {
  const serialized = serializeProjectFile(project, projectSchemaUrl());
  try {
    storage.setItem(RECOVERY_STORAGE_KEY, serialized);
  } catch {
    return;
  }
};

export const clearRecovery = (storage: Storage): void => {
  try {
    storage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    return;
  }
};
