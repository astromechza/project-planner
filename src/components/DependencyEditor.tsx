import { useState } from 'react';
import {
  getBlockedBy,
  getBlocks,
  isTaskInDependencyCycle,
} from '../domain/dependencies';
import type { Project, TaskId } from '../domain/types';

interface DependencyEditorProps {
  readonly project: Project;
  readonly selectedTaskId: TaskId;
  readonly onLink: (blockerId: TaskId, blockedId: TaskId) => void;
  readonly onUnlink: (blockerId: TaskId, blockedId: TaskId) => void;
}

const getTaskTitle = (project: Project, taskId: TaskId): string =>
  project.tasks[taskId]?.title ?? 'Deleted task';

interface DependencyControlProps {
  readonly label: 'Blocks' | 'Blocked by';
  readonly candidateTaskIds: readonly TaskId[];
  readonly project: Project;
  readonly onAdd: (taskId: TaskId) => void;
}

function DependencyControl({
  label,
  candidateTaskIds,
  project,
  onAdd,
}: DependencyControlProps): React.JSX.Element {
  const [candidateTaskId, setCandidateTaskId] = useState<TaskId | ''>('');
  const isBlocksControl = label === 'Blocks';

  return (
    <div className="dependency-control">
      <label>
        {label}
        <select
          aria-label={label}
          className="dependency-control-select"
          value={candidateTaskId}
          onChange={(event) => {
            setCandidateTaskId(event.currentTarget.value as TaskId);
          }}
        >
          <option value="">Choose a task</option>
          {candidateTaskIds.map((taskId) => (
            <option key={taskId} value={taskId}>
              {getTaskTitle(project, taskId)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={candidateTaskId === ''}
        onClick={() => {
          if (candidateTaskId !== '') {
            onAdd(candidateTaskId);
            setCandidateTaskId('');
          }
        }}
      >
        {isBlocksControl ? 'Add blocked task' : 'Add blocker'}
      </button>
    </div>
  );
}

interface DependencyListProps {
  readonly label: string;
  readonly taskIds: readonly TaskId[];
  readonly project: Project;
  readonly relationship: 'blocking' | 'blocker';
  readonly onRemove: (taskId: TaskId) => void;
}

function DependencyList({
  label,
  taskIds,
  project,
  relationship,
  onRemove,
}: DependencyListProps): React.JSX.Element | null {
  if (taskIds.length === 0) {
    return null;
  }

  return (
    <ul className="dependency-list" aria-label={label}>
      {taskIds.map((taskId) => {
        const title = getTaskTitle(project, taskId);
        const removeLabel =
          relationship === 'blocking'
            ? `Remove blocking relationship with ${title}`
            : `Remove blocker relationship with ${title}`;

        return (
          <li key={taskId}>
            <span>{title}</span>
            <button
              type="button"
              aria-label={removeLabel}
              onClick={() => {
                onRemove(taskId);
              }}
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function DependencyEditor({
  project,
  selectedTaskId,
  onLink,
  onUnlink,
}: DependencyEditorProps): React.JSX.Element {
  const blockedTaskIds = getBlocks(project, selectedTaskId);
  const blockerTaskIds = getBlockedBy(project, selectedTaskId);
  const blockedTaskIdSet = new Set(blockedTaskIds);
  const blockerTaskIdSet = new Set(blockerTaskIds);
  const taskIds = Object.keys(project.tasks) as TaskId[];
  const blockedTaskCandidates = taskIds.filter(
    (taskId) => taskId !== selectedTaskId && !blockedTaskIdSet.has(taskId),
  );
  const blockerTaskCandidates = taskIds.filter(
    (taskId) => taskId !== selectedTaskId && !blockerTaskIdSet.has(taskId),
  );
  const selectedTaskIsInCycle = isTaskInDependencyCycle(
    project,
    selectedTaskId,
  );

  return (
    <section className="dependency-editor" aria-label="Blocker relationships">
      <h2>Blockers</h2>
      {selectedTaskIsInCycle ? (
        <p className="dependency-cycle-warning" role="alert">
          Dependency cycle detected. This task is part of a blocker cycle.
        </p>
      ) : null}
      <DependencyControl
        key={`${selectedTaskId}-blocks`}
        label="Blocks"
        candidateTaskIds={blockedTaskCandidates}
        project={project}
        onAdd={(blockedId) => {
          onLink(selectedTaskId, blockedId);
        }}
      />
      <DependencyList
        label="Tasks blocked by this task"
        taskIds={blockedTaskIds}
        project={project}
        relationship="blocking"
        onRemove={(blockedId) => {
          onUnlink(selectedTaskId, blockedId);
        }}
      />
      <DependencyControl
        key={`${selectedTaskId}-blocked-by`}
        label="Blocked by"
        candidateTaskIds={blockerTaskCandidates}
        project={project}
        onAdd={(blockerId) => {
          onLink(blockerId, selectedTaskId);
        }}
      />
      <DependencyList
        label="Tasks blocking this task"
        taskIds={blockerTaskIds}
        project={project}
        relationship="blocker"
        onRemove={(blockerId) => {
          onUnlink(blockerId, selectedTaskId);
        }}
      />
    </section>
  );
}
