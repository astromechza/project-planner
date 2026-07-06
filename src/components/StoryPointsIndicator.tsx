interface StoryPointsIndicatorProps {
  readonly total: number;
}

export function StoryPointsIndicator({
  total,
}: StoryPointsIndicatorProps): React.JSX.Element | null {
  if (total <= 0) {
    return null;
  }

  return (
    <span
      className="story-points-indicator"
      role="img"
      aria-label={`${String(total)} story points`}
    >
      {total}
    </span>
  );
}
