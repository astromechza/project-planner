import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskNotesIndicator } from './TaskNotesIndicator';

afterEach(cleanup);

describe('TaskNotesIndicator', () => {
  it('renders an accessible speech-bubble indicator when notes exist', () => {
    const { container } = render(<TaskNotesIndicator hasNotes />);

    expect(screen.getByRole('img', { name: 'Has notes' })).toBeInTheDocument();
    expect(
      container.querySelector('.task-notes-indicator svg'),
    ).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing when notes are absent', () => {
    render(<TaskNotesIndicator hasNotes={false} />);

    expect(
      screen.queryByRole('img', { name: 'Has notes' }),
    ).not.toBeInTheDocument();
  });
});
