# Task Notes Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a neutral speech-bubble icon at the end of a tree-row title whenever the task has non-whitespace notes.

**Architecture:** Extend the existing local Lucide path-data module with the canonical `MessageCircle` path, render it through a focused `TaskNotesIndicator` component, and let `TreeRow` derive visibility with `task.notes?.trim().length > 0`. CSS owns sizing and neutral color; the persisted task model and inspector remain unchanged.

**Tech Stack:** React 19, TypeScript strict mode, local SVG path data sourced from Lucide, Vitest, Testing Library, Vite.

---

### Task 1: Add and test the vendored MessageCircle path

**Files:**
- Modify: `src/components/taskTypeIconData.ts:1-30`
- Modify: `src/components/taskTypeIconData.test.ts:1-20`

- [ ] **Step 1: Write the failing path-data assertion**

Add this test to `src/components/taskTypeIconData.test.ts`:

```ts
  it('contains the canonical MessageCircle path for notes', () => {
    expect(TASK_NOTES_ICON_PATHS).toEqual([
      'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
    ]);
  });
```

Also update the import:

```ts
import {
  TASK_NOTES_ICON_PATHS,
  TASK_TYPE_ICON_PATHS,
} from './taskTypeIconData';
```

- [ ] **Step 2: Run the data test to verify it fails**

Run: `npm test -- --run --coverage.enabled=false src/components/taskTypeIconData.test.ts`

Expected: FAIL because `TASK_NOTES_ICON_PATHS` is not exported yet.

- [ ] **Step 3: Add the canonical local path data**

In `src/components/taskTypeIconData.ts`, add after `taskCheckPath`:

```ts
export const TASK_NOTES_ICON_PATHS = [
  'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
] as const;
```

- [ ] **Step 4: Run the data test to verify it passes**

Run: `npm test -- --run --coverage.enabled=false src/components/taskTypeIconData.test.ts`

Expected: PASS for existing task paths, Task/Subtask reuse, and MessageCircle path data.

- [ ] **Step 5: Commit the path-data change**

```bash
git add src/components/taskTypeIconData.ts src/components/taskTypeIconData.test.ts
git commit -m "feat: add notes indicator icon data"
```

### Task 2: Build and test the notes indicator component

**Files:**
- Create: `src/components/TaskNotesIndicator.tsx`
- Test: `src/components/TaskNotesIndicator.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/TaskNotesIndicator.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskNotesIndicator } from './TaskNotesIndicator';

afterEach(cleanup);

describe('TaskNotesIndicator', () => {
  it('renders an accessible speech-bubble indicator when notes exist', () => {
    const { container } = render(<TaskNotesIndicator hasNotes />);

    expect(
      screen.getByRole('img', { name: 'Has notes' }),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.task-notes-indicator svg'),
    ).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders nothing when notes are absent', () => {
    render(<TaskNotesIndicator hasNotes={false} />);

    expect(screen.queryByRole('img', { name: 'Has notes' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component tests to verify they fail**

Run: `npm test -- --run --coverage.enabled=false src/components/TaskNotesIndicator.test.tsx`

Expected: FAIL because `TaskNotesIndicator` does not exist yet.

- [ ] **Step 3: Implement the non-interactive indicator**

Create `src/components/TaskNotesIndicator.tsx`:

```tsx
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
    <span
      className="task-notes-indicator"
      role="img"
      aria-label="Has notes"
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
        {TASK_NOTES_ICON_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}
```

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `npm test -- --run --coverage.enabled=false src/components/TaskNotesIndicator.test.tsx`

Expected: PASS for visible/hidden behavior and accessible labeling.

- [ ] **Step 5: Commit the component**

```bash
git add src/components/TaskNotesIndicator.tsx src/components/TaskNotesIndicator.test.tsx
git commit -m "feat: add task notes indicator component"
```

### Task 3: Integrate the indicator into tree rows

**Files:**
- Modify: `src/components/TreeRow.tsx:1-270`
- Modify: `src/components/planner.css:250-280`
- Test: `src/components/TreeRow.test.tsx:1-140`

- [ ] **Step 1: Write the failing row integration tests**

Update the test task fixture to include no notes by default, then add:

```tsx
  it('renders notes at the end of a task title', () => {
    const taskWithNotes: PlanTask = {
      ...task,
      notes: 'Remember the deployment checklist.',
    };
    render(
      <TreeRow
        task={taskWithNotes}
        depth={1}
        selected={false}
        blocksSelected={false}
        blockedBySelected={false}
        blocksCount={0}
        blockedByCount={0}
        tabbable={false}
        expanded={false}
        dragging={false}
        treeItemRef={vi.fn()}
        onSelect={vi.fn()}
        onKeyDown={vi.fn()}
        onToggleExpanded={vi.fn()}
        onUpdateTitle={vi.fn()}
      />,
    );

    const title = screen.getByText('Initiative');
    const indicator = screen.getByRole('img', { name: 'Has notes' });

    expect(title.compareDocumentPosition(indicator)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('omits the notes indicator for whitespace-only notes', () => {
    const whitespaceTask: PlanTask = { ...task, notes: ' \n\t ' };
    render(
      <TreeRow
        task={whitespaceTask}
        depth={1}
        selected={false}
        blocksSelected={false}
        blockedBySelected={false}
        blocksCount={0}
        blockedByCount={0}
        tabbable={false}
        expanded={false}
        dragging={false}
        treeItemRef={vi.fn()}
        onSelect={vi.fn()}
        onKeyDown={vi.fn()}
        onToggleExpanded={vi.fn()}
        onUpdateTitle={vi.fn()}
      />,
    );

    expect(screen.queryByRole('img', { name: 'Has notes' })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the row tests to verify the new tests fail**

Run: `npm test -- --run --coverage.enabled=false src/components/TreeRow.test.tsx -t "notes"`

Expected: FAIL because `TreeRow` does not render a notes indicator.

- [ ] **Step 3: Render the indicator from trimmed notes**

Import the component:

```tsx
import { TaskNotesIndicator } from './TaskNotesIndicator';
```

Immediately after `const hasDependencies = ...`, add:

```tsx
  const hasNotes = (task.notes?.trim().length ?? 0) > 0;
```

Immediately after the title conditional and before the dependency indicator,
render:

```tsx
      <TaskNotesIndicator hasNotes={hasNotes} />
```

- [ ] **Step 4: Add neutral icon layout styling**

In `src/components/planner.css`, add:

```css
.task-notes-indicator {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  color: #5e6c84;
}

.task-notes-indicator svg {
  width: 16px;
  height: 16px;
}
```

- [ ] **Step 5: Run the focused row and indicator suites**

Run: `npm test -- --run --coverage.enabled=false src/components/TreeRow.test.tsx src/components/TaskNotesIndicator.test.tsx src/components/taskTypeIconData.test.ts`

Expected: all notes, icon-data, and existing row tests pass.

- [ ] **Step 6: Commit the row integration**

```bash
git add src/components/TreeRow.tsx src/components/planner.css src/components/TreeRow.test.tsx
git commit -m "feat: show notes indicators in task rows"
```

### Task 4: Verify the complete planner

**Files:**
- Verify only: all project source, test, and documentation files

- [ ] **Step 1: Run the full quality gate**

Run: `npm run verify`

Expected: Prettier, ESLint, strict TypeScript, all Vitest tests with coverage thresholds, and the Vite production build pass.

- [ ] **Step 2: Inspect the final worktree**

Run: `git status --short && git log --oneline -6`

Expected: a clean worktree with the notes path data, indicator component, row integration, tests, and commits visible in recent history.
