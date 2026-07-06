import {
  parseProjectFile,
  serializeProjectFile,
} from '../infrastructure/projectFile';
import { useEffect, useRef, useState } from 'react';
import type { Project } from '../domain/types';
import type { ImportError } from '../app/projectReducer';

interface AppToolbarProps {
  readonly project: Project;
  readonly onRenamePlan: (name: string) => void;
  readonly onNewPlan: () => void;
  readonly onImportSuccess: (project: Project) => void;
  readonly onImportFailure: (error: ImportError) => void;
  readonly shortcutsOpen: boolean;
  readonly onShowShortcuts: (opener: HTMLElement) => void;
}

const hasTasks = (project: Project): boolean => project.rootTaskIds.length > 0;

export function AppToolbar({
  project,
  onRenamePlan,
  onNewPlan,
  onImportSuccess,
  onImportFailure,
  shortcutsOpen,
  onShowShortcuts,
}: AppToolbarProps): React.JSX.Element {
  const [editingPlanName, setEditingPlanName] = useState(false);
  const [draftPlanName, setDraftPlanName] = useState(project.name);
  const planTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingPlanName) {
      planTitleInputRef.current?.focus();
      planTitleInputRef.current?.select();
    }
  }, [editingPlanName]);

  const startEditingPlanName = (): void => {
    setDraftPlanName(project.name);
    setEditingPlanName(true);
  };

  const cancelEditingPlanName = (): void => {
    setDraftPlanName(project.name);
    setEditingPlanName(false);
  };

  const savePlanName = (): void => {
    const nextName = draftPlanName.trim();
    if (nextName !== '' && nextName !== project.name) {
      onRenamePlan(nextName);
    }
    setEditingPlanName(false);
  };

  const handleNewPlan = (): void => {
    if (
      !hasTasks(project) ||
      window.confirm('Start a new plan? The current plan will be replaced.')
    ) {
      onNewPlan();
    }
  };

  const handleImport = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.currentTarget.files?.item(0);
    event.currentTarget.value = '';
    if (file === null || file === undefined) {
      return;
    }

    try {
      const parsed = parseProjectFile(await file.text());
      if (parsed.ok) {
        onImportSuccess(parsed.value);
      } else {
        onImportFailure(parsed.error);
      }
    } catch {
      onImportFailure('FILE_READ_FAILED');
    }
  };

  const handleExport = (): void => {
    const file = new Blob([serializeProjectFile(project)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'project-plan.json';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="planner-toolbar">
      <h1 onDoubleClick={startEditingPlanName}>
        {editingPlanName ? (
          <input
            aria-label="Plan title"
            ref={planTitleInputRef}
            value={draftPlanName}
            onChange={(event) => {
              setDraftPlanName(event.currentTarget.value);
            }}
            onBlur={savePlanName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                savePlanName();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEditingPlanName();
              }
            }}
          />
        ) : (
          project.name
        )}
      </h1>
      <div className="planner-toolbar-actions">
        <button type="button" onClick={handleNewPlan}>
          New plan
        </button>
        <label className="planner-file-action">
          Import
          <input
            aria-label="Import project file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              void handleImport(event);
            }}
          />
        </label>
        <button type="button" onClick={handleExport}>
          Export
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={shortcutsOpen}
          onClick={(event) => {
            onShowShortcuts(event.currentTarget);
          }}
        >
          Keyboard shortcuts
        </button>
      </div>
    </header>
  );
}
