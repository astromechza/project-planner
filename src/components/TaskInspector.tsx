import { getTaskType } from '../domain/project';
import { STORY_POINT_OPTIONS } from '../domain/types';
import { isStoryPoints } from '../domain/storyPoints';
import type { TaskUpdate } from '../domain/tree';
import type { Project, TaskId } from '../domain/types';
import { DependencyEditor } from './DependencyEditor';

interface TaskInspectorProps {
  readonly project: Project;
  readonly selectedTaskId: TaskId | null;
  readonly onCreateChild: (parentId: TaskId) => void;
  readonly onUpdateTask: (taskId: TaskId, update: TaskUpdate) => void;
  readonly onDeleteTask: (taskId: TaskId) => void;
  readonly onLinkDependency: (blockerId: TaskId, blockedId: TaskId) => void;
  readonly onUnlinkDependency: (blockerId: TaskId, blockedId: TaskId) => void;
}

export function TaskInspector({
  project,
  selectedTaskId,
  onCreateChild,
  onUpdateTask,
  onDeleteTask,
  onLinkDependency,
  onUnlinkDependency,
}: TaskInspectorProps): React.JSX.Element {
  const task =
    selectedTaskId === null ? undefined : project.tasks[selectedTaskId];

  if (task === undefined) {
    return (
      <aside className="task-inspector" aria-label="Task inspector">
        <p>Select a task to view and edit its details.</p>
      </aside>
    );
  }

  const taskType = getTaskType(project, task.id);
  const hasIncidentDependencies = project.dependencies.some(
    (dependency) =>
      dependency.blockerId === task.id || dependency.blockedId === task.id,
  );
  const requiresDeleteConfirmation =
    task.childIds.length > 0 || hasIncidentDependencies;

  const handleDelete = (): void => {
    if (
      !requiresDeleteConfirmation ||
      window.confirm(
        'Delete this task and all of its children? Its blocker links will also be removed.',
      )
    ) {
      onDeleteTask(task.id);
    }
  };

  return (
    <aside className="task-inspector" aria-label="Task inspector">
      <p className="task-type">{taskType ?? 'Unknown task type'}</p>
      <label>
        Title
        <input
          aria-label="Task title"
          value={task.title}
          onChange={(event) => {
            onUpdateTask(task.id, { title: event.currentTarget.value });
          }}
        />
      </label>
      <label>
        Notes
        <textarea
          aria-label="Task notes"
          value={task.notes ?? ''}
          onChange={(event) => {
            onUpdateTask(task.id, { notes: event.currentTarget.value });
          }}
        />
      </label>
      <label>
        Story points
        <select
          aria-label="Story points"
          value={task.storyPoints?.toString() ?? ''}
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value === '') {
              onUpdateTask(task.id, { storyPoints: undefined });
              return;
            }

            const parsed = Number(value);
            onUpdateTask(task.id, {
              storyPoints: isStoryPoints(parsed) ? parsed : undefined,
            });
          }}
        >
          <option value="">None</option>
          {STORY_POINT_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <div className="task-internal-id">
        <span>Internal ID</span>
        <code aria-label="Internal ID value">{task.id}</code>
        <button
          type="button"
          aria-label="Copy internal ID"
          onClick={() => {
            void navigator.clipboard.writeText(task.id).catch(() => undefined);
          }}
        >
          Copy
        </button>
      </div>
      <DependencyEditor
        project={project}
        selectedTaskId={task.id}
        onLink={onLinkDependency}
        onUnlink={onUnlinkDependency}
      />
      <div className="task-inspector-actions">
        <button
          type="button"
          disabled={taskType === 'Subtask'}
          title={
            taskType === 'Subtask'
              ? 'A Subtask cannot contain children.'
              : undefined
          }
          onClick={() => {
            onCreateChild(task.id);
          }}
        >
          Add child
        </button>
        <button type="button" className="danger" onClick={handleDelete}>
          Delete task
        </button>
      </div>
    </aside>
  );
}
