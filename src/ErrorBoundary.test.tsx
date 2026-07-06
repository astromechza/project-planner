import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function ThrowingChild(): React.JSX.Element {
  throw new Error('Simulated render failure');
}

describe('ErrorBoundary', () => {
  it('offers reload and a blank-plan recovery path without claiming recovery exists', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>,
      );

      expect(
        screen.getByRole('main', { name: 'Project planner error' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'Recovery data may still be available in this browser.',
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Reload planner' }),
      ).toBeEnabled();
      expect(
        screen.getByRole('button', { name: 'Start a blank plan' }),
      ).toBeEnabled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
