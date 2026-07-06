import { describe, expect, it } from 'vitest';
import {
  TASK_NOTES_ICON_PATHS,
  TASK_TYPE_ICON_PATHS,
} from './taskTypeIconData';

describe('vendored Lucide task icon data', () => {
  it('contains non-empty SVG path data for every supported task type', () => {
    for (const type of ['initiative', 'epic', 'story', 'task'] as const) {
      expect(TASK_TYPE_ICON_PATHS[type].length).toBeGreaterThan(0);
      expect(TASK_TYPE_ICON_PATHS[type].every((path) => path.length > 0)).toBe(
        true,
      );
    }
  });

  it('reuses the task path for subtasks', () => {
    expect(TASK_TYPE_ICON_PATHS.subtask).toBe(TASK_TYPE_ICON_PATHS.task);
  });

  it('contains the canonical MessageCircle path for notes', () => {
    expect(TASK_NOTES_ICON_PATHS).toEqual([
      'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
    ]);
  });
});
