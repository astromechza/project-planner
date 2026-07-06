import { TASK_TYPE_ICON_PATHS } from './taskTypeIconData';

interface TaskTypeIconProps {
  readonly depth: number;
}

type TaskType = keyof typeof TASK_TYPE_ICON_PATHS;

const taskTypeForDepth = (depth: number): TaskType => {
  switch (depth) {
    case 1:
      return 'initiative';
    case 2:
      return 'epic';
    case 3:
      return 'story';
    case 4:
      return 'task';
    default:
      return 'subtask';
  }
};

export function TaskTypeIcon({ depth }: TaskTypeIconProps): React.JSX.Element {
  const taskType = taskTypeForDepth(depth);

  return (
    <span
      aria-hidden="true"
      className={`task-type-icon task-type-icon--${taskType}`}
    >
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
        {TASK_TYPE_ICON_PATHS[taskType].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
