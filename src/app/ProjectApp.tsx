import { useEffect, useReducer, useRef, useState } from 'react';
import { AppToolbar } from '../components/AppToolbar';
import { KeyboardShortcutsDialog } from '../components/KeyboardShortcutsDialog';
import { TaskInspector } from '../components/TaskInspector';
import { TreeGrid } from '../components/TreeGrid';
import { WorkspaceSplitter } from '../components/WorkspaceSplitter';
import { createEmptyProject } from '../domain/project';
import { loadRecovery, saveRecovery } from '../infrastructure/recoveryStore';
import '../components/planner.css';
import {
  createInitialAppState,
  createNewProject,
  projectReducer,
} from './projectReducer';

const defaultInspectorWidth = 28 * 16;
const minimumInspectorWidth = 18 * 16;
const maximumInspectorWidth = Math.max(
  minimumInspectorWidth,
  window.innerWidth - minimumInspectorWidth,
);

const getBrowserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const loadInitialState = () => {
  const storage = getBrowserStorage();
  const recoveredProject = storage === null ? null : loadRecovery(storage);

  return createInitialAppState(
    recoveredProject ?? createEmptyProject('Untitled plan'),
  );
};

export function ProjectApp(): React.JSX.Element {
  const [state, dispatch] = useReducer(
    projectReducer,
    undefined,
    loadInitialState,
  );
  const hasSavedInitialProject = useRef(false);
  const shortcutsOpenerRef = useRef<HTMLElement | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [inspectorWidth, setInspectorWidth] = useState(defaultInspectorWidth);

  useEffect(() => {
    if (!hasSavedInitialProject.current) {
      hasSavedInitialProject.current = true;
      return;
    }

    const storage = getBrowserStorage();
    if (storage !== null) {
      saveRecovery(storage, state.project);
    }
  }, [state.project]);

  useEffect(() => {
    if (!shortcutsOpen && shortcutsOpenerRef.current !== null) {
      const opener = shortcutsOpenerRef.current;
      shortcutsOpenerRef.current = null;
      opener.focus();
    }
  }, [shortcutsOpen]);

  const showShortcuts = (opener: HTMLElement): void => {
    shortcutsOpenerRef.current = opener;
    setShortcutsOpen(true);
  };

  const closeShortcuts = (): void => {
    setShortcutsOpen(false);
  };

  return (
    <main className="project-planner" aria-label="Project planner">
      <AppToolbar
        project={state.project}
        onRenamePlan={(name) => {
          dispatch({ type: 'rename plan', name });
        }}
        onNewPlan={() => {
          dispatch({ type: 'import succeeded', project: createNewProject() });
        }}
        onImportSuccess={(project) => {
          dispatch({ type: 'import succeeded', project });
        }}
        onImportFailure={(error) => {
          dispatch({ type: 'import failed', error });
        }}
        shortcutsOpen={shortcutsOpen}
        onShowShortcuts={showShortcuts}
      />
      {state.error === null ? null : (
        <p className="planner-operation-error" role="alert">
          {state.error}
        </p>
      )}
      <section
        className="planner-workspace"
        aria-label="Plan workspace"
        style={
          {
            '--inspector-width': `${inspectorWidth.toString()}px`,
          } as React.CSSProperties
        }
      >
        <section className="planner-canvas" aria-label="Project tasks">
          <div className="planner-canvas-header">
            <button
              type="button"
              onClick={() => {
                dispatch({
                  type: 'create',
                  parentId: null,
                  title: 'Untitled initiative',
                });
              }}
            >
              Add initiative
            </button>
            {state.project.rootTaskIds.length === 0 ? (
              <span className="planner-shortcut-hint">
                Need shortcuts? Press ?
              </span>
            ) : null}
          </div>
          <TreeGrid
            project={state.project}
            selectedTaskId={state.selectedTaskId}
            onSelect={(taskId) => {
              dispatch({ type: 'select', taskId });
            }}
            onCreateSibling={(parentId, index) => {
              dispatch({
                type: 'create',
                parentId,
                title: 'Untitled task',
                index,
              });
            }}
            onMove={(taskId, destination) => {
              dispatch({ type: 'move', taskId, destination });
            }}
            onUpdateTask={(taskId, update) => {
              dispatch({ type: 'update', taskId, update });
            }}
            onShowShortcuts={showShortcuts}
          />
        </section>
        <WorkspaceSplitter
          value={inspectorWidth}
          minimum={minimumInspectorWidth}
          maximum={maximumInspectorWidth}
          onChange={setInspectorWidth}
        />
        <TaskInspector
          project={state.project}
          selectedTaskId={state.selectedTaskId}
          onCreateChild={(parentId) => {
            dispatch({
              type: 'create',
              parentId,
              title: 'Untitled task',
            });
          }}
          onUpdateTask={(taskId, update) => {
            dispatch({ type: 'update', taskId, update });
          }}
          onDeleteTask={(taskId) => {
            dispatch({ type: 'delete', taskId });
          }}
          onLinkDependency={(blockerId, blockedId) => {
            dispatch({ type: 'link', blockerId, blockedId });
          }}
          onUnlinkDependency={(blockerId, blockedId) => {
            dispatch({ type: 'unlink', blockerId, blockedId });
          }}
        />
      </section>
      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
    </main>
  );
}
