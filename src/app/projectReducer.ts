import { linkDependency, unlinkDependency } from '../domain/dependencies';
import { createEmptyProject } from '../domain/project';
import {
  addTask,
  deleteTask,
  moveTask,
  updateTask,
  type TaskDestination,
  type TaskUpdate,
} from '../domain/tree';
import type { Project, TaskId } from '../domain/types';
import type { ProjectFileError } from '../infrastructure/projectFile';

export interface AppState {
  readonly project: Project;
  readonly selectedTaskId: TaskId | null;
  readonly error: string | null;
}

export type ImportError = ProjectFileError | 'FILE_READ_FAILED';

export type ProjectAction =
  | { readonly type: 'select'; readonly taskId: TaskId | null }
  | { readonly type: 'rename plan'; readonly name: string }
  | {
      readonly type: 'create';
      readonly parentId: TaskId | null;
      readonly title: string;
      readonly index?: number;
    }
  | {
      readonly type: 'update';
      readonly taskId: TaskId;
      readonly update: TaskUpdate;
    }
  | {
      readonly type: 'move';
      readonly taskId: TaskId;
      readonly destination: TaskDestination;
    }
  | { readonly type: 'delete'; readonly taskId: TaskId }
  | {
      readonly type: 'link';
      readonly blockerId: TaskId;
      readonly blockedId: TaskId;
    }
  | {
      readonly type: 'unlink';
      readonly blockerId: TaskId;
      readonly blockedId: TaskId;
    }
  | { readonly type: 'import succeeded'; readonly project: Project }
  | { readonly type: 'import failed'; readonly error: ImportError };

const errorMessages: Readonly<Record<string, string>> = {
  TASK_NOT_FOUND: 'The selected task no longer exists.',
  PARENT_NOT_FOUND: 'The selected parent task no longer exists.',
  MAX_DEPTH_EXCEEDED: 'A plan cannot be deeper than five levels.',
  CYCLE: 'A task cannot be moved beneath itself or one of its descendants.',
  INVALID_INDEX: 'The requested task position is invalid.',
  SELF_DEPENDENCY: 'A task cannot block itself.',
  DUPLICATE_DEPENDENCY: 'That blocker relationship already exists.',
  INVALID_JSON: 'Cannot import project: invalid JSON.',
  UNSUPPORTED_FORMAT: 'Cannot import project: unsupported file format.',
  INVALID_PROJECT: 'Cannot import project: invalid project data.',
  FILE_READ_FAILED:
    'Cannot import project: the selected file could not be read.',
};

const messageFor = (error: string): string =>
  errorMessages[error] ??
  'The requested planner operation could not be completed.';

const withProject = (state: AppState, project: Project): AppState => ({
  ...state,
  project,
  error: null,
});

export const createInitialAppState = (project: Project): AppState => ({
  project,
  selectedTaskId: null,
  error: null,
});

export const projectReducer = (
  state: AppState,
  action: ProjectAction,
): AppState => {
  switch (action.type) {
    case 'select':
      return { ...state, selectedTaskId: action.taskId, error: null };
    case 'rename plan':
      return withProject(state, { ...state.project, name: action.name });
    case 'create': {
      const result = addTask(
        state.project,
        action.parentId,
        action.title,
        action.index,
      );
      return result.ok
        ? {
            project: result.value.project,
            selectedTaskId: result.value.task.id,
            error: null,
          }
        : { ...state, error: messageFor(result.error) };
    }
    case 'update': {
      const result = updateTask(state.project, action.taskId, action.update);
      return result.ok
        ? withProject(state, result.value)
        : { ...state, error: messageFor(result.error) };
    }
    case 'move': {
      const result = moveTask(state.project, action.taskId, action.destination);
      return result.ok
        ? withProject(state, result.value)
        : { ...state, error: messageFor(result.error) };
    }
    case 'delete': {
      const result = deleteTask(state.project, action.taskId);
      if (!result.ok) {
        return { ...state, error: messageFor(result.error) };
      }

      const selectedTaskWasDeleted =
        state.selectedTaskId !== null &&
        !Object.hasOwn(result.value.tasks, state.selectedTaskId);
      return {
        project: result.value,
        selectedTaskId: selectedTaskWasDeleted ? null : state.selectedTaskId,
        error: null,
      };
    }
    case 'link': {
      const result = linkDependency(
        state.project,
        action.blockerId,
        action.blockedId,
      );
      return result.ok
        ? withProject(state, result.value)
        : { ...state, error: messageFor(result.error) };
    }
    case 'unlink':
      return withProject(
        state,
        unlinkDependency(state.project, action.blockerId, action.blockedId),
      );
    case 'import succeeded':
      return { project: action.project, selectedTaskId: null, error: null };
    case 'import failed':
      return { ...state, error: messageFor(action.error) };
  }
};

export const createNewProject = (): Project =>
  createEmptyProject('Untitled plan');
