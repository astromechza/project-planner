import { useId, useState } from 'react';
import { getBlockedBy, isTaskInDependencyCycle } from '../domain/dependencies';
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
  readonly candidateTaskIds: readonly TaskId[];
  readonly project: Project;
  readonly onAdd: (taskId: TaskId) => void;
}

interface CandidateOption {
  readonly taskId: TaskId;
  readonly displayText: string;
}

function buildCandidateOptions(
  candidateTaskIds: readonly TaskId[],
  project: Project,
): readonly CandidateOption[] {
  const usedTexts = new Set<string>();

  return candidateTaskIds.map((taskId) => {
    const title = getTaskTitle(project, taskId);
    let displayText = title;
    let suffix = 2;
    while (usedTexts.has(displayText)) {
      displayText = `${title} (${String(suffix)})`;
      suffix += 1;
    }
    usedTexts.add(displayText);

    return { taskId, displayText };
  });
}

function DependencyControl({
  candidateTaskIds,
  project,
  onAdd,
}: DependencyControlProps): React.JSX.Element {
  const [inputText, setInputText] = useState('');
  const listId = useId();
  const options = buildCandidateOptions(candidateTaskIds, project);
  const optionByText = new Map(
    options.map((option) => [option.displayText, option.taskId]),
  );
  const selectedTaskId =
    inputText === '' ? undefined : optionByText.get(inputText);

  return (
    <div className="dependency-control">
      <label>
        Blocked by
        <input
          aria-label="Blocked by"
          className="dependency-control-select"
          list={listId}
          placeholder="Type to filter tasks"
          value={inputText}
          onChange={(event) => {
            setInputText(event.currentTarget.value);
          }}
        />
      </label>
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.taskId} value={option.displayText} />
        ))}
      </datalist>
      <button
        type="button"
        disabled={selectedTaskId === undefined}
        onClick={() => {
          if (selectedTaskId !== undefined) {
            onAdd(selectedTaskId);
            setInputText('');
          }
        }}
      >
        Add blocker
      </button>
    </div>
  );
}

interface DependencyListProps {
  readonly label: string;
  readonly taskIds: readonly TaskId[];
  readonly project: Project;
  readonly onRemove: (taskId: TaskId) => void;
}

function DependencyList({
  label,
  taskIds,
  project,
  onRemove,
}: DependencyListProps): React.JSX.Element | null {
  if (taskIds.length === 0) {
    return null;
  }

  return (
    <ul className="dependency-list" aria-label={label}>
      {taskIds.map((taskId) => {
        const title = getTaskTitle(project, taskId);

        return (
          <li key={taskId}>
            <span>{title}</span>
            <button
              type="button"
              aria-label={`Remove blocker relationship with ${title}`}
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
  const blockerTaskIds = getBlockedBy(project, selectedTaskId);
  const blockerTaskIdSet = new Set(blockerTaskIds);
  const taskIds = Object.keys(project.tasks) as TaskId[];
  const blockerTaskCandidates = taskIds
    .filter(
      (taskId) => taskId !== selectedTaskId && !blockerTaskIdSet.has(taskId),
    )
    .sort((a, b) =>
      getTaskTitle(project, a).localeCompare(
        getTaskTitle(project, b),
        undefined,
        {
          numeric: true,
          sensitivity: 'base',
        },
      ),
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
        key={`${selectedTaskId}-blocked-by`}
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
        onRemove={(blockerId) => {
          onUnlink(blockerId, selectedTaskId);
        }}
      />
    </section>
  );
}
