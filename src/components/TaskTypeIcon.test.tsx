import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskTypeIcon } from './TaskTypeIcon';

afterEach(cleanup);

describe('TaskTypeIcon', () => {
  it.each([
    [1, 'initiative'],
    [2, 'epic'],
    [3, 'story'],
    [4, 'task'],
    [5, 'subtask'],
  ] as const)('maps depth %d to the %s icon class', (depth, type) => {
    const { container } = render(<TaskTypeIcon depth={depth} />);

    const icon = container.querySelector(`.task-type-icon--${type}`);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.querySelector('svg')).not.toBeNull();
  });

  it('falls back to the deepest supported type for an out-of-range depth', () => {
    const { container } = render(<TaskTypeIcon depth={6} />);

    expect(container.querySelector('.task-type-icon--subtask')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
