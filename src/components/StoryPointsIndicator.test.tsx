import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StoryPointsIndicator } from './StoryPointsIndicator';

afterEach(cleanup);

describe('StoryPointsIndicator', () => {
  it('renders a labelled bubble for a positive total', () => {
    render(<StoryPointsIndicator total={22} />);

    const indicator = screen.getByRole('img', { name: '22 story points' });
    expect(indicator).toHaveTextContent('22');
  });

  it('renders nothing for a zero total', () => {
    render(<StoryPointsIndicator total={0} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
