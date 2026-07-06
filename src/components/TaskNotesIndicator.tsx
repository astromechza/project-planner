import { TASK_NOTES_ICON_PATHS } from './taskTypeIconData';

interface TaskNotesIndicatorProps {
  readonly hasNotes: boolean;
}

export function TaskNotesIndicator({
  hasNotes,
}: TaskNotesIndicatorProps): React.JSX.Element | null {
  if (!hasNotes) {
    return null;
  }

  return (
    <span className="task-notes-indicator" role="img" aria-label="Has notes">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {TASK_NOTES_ICON_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
