# Task Type Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Jira-style, depth-derived icons and colors in every planner tree row without changing task data or adding a runtime dependency.

**Architecture:** Vendor the four official Lucide SVG path definitions in a small local data module and render them through a typed `TaskTypeIcon` component. `TreeRow` passes its existing `depth` prop to that component, while CSS owns the compact layout and Jira-like palette. The icon is decorative; existing row labels and ARIA levels remain authoritative.

**Tech Stack:** React 19, TypeScript strict mode, local SVG path data sourced from Lucide, Vitest, Testing Library, Vite.

---

### Task 1: Add the vendored Lucide icon data with provenance

**Files:**
- Create: `src/components/taskTypeIconData.ts`
- Test: `src/components/taskTypeIconData.test.ts`
- Create: `docs/THIRD_PARTY_NOTICES.md`

- [ ] **Step 1: Write the failing data-shape test**

Create `src/components/taskTypeIconData.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TASK_TYPE_ICON_PATHS } from './taskTypeIconData';

describe('vendored Lucide task icon data', () => {
  it('contains non-empty SVG path data for every supported task type', () => {
    for (const type of ['initiative', 'epic', 'story', 'task'] as const) {
      expect(TASK_TYPE_ICON_PATHS[type].length).toBeGreaterThan(0);
      expect(TASK_TYPE_ICON_PATHS[type].every((path) => path.length > 0)).toBe(
        true,
      );
    }
  });

  it('reuses the task path for subtasks', () => {
    expect(TASK_TYPE_ICON_PATHS.subtask).toBe(TASK_TYPE_ICON_PATHS.task);
  });
});
```

- [ ] **Step 2: Run the data test to verify it fails**

Run: `npm test -- --run --coverage.enabled=false src/components/taskTypeIconData.test.ts`

Expected: FAIL because the local icon data module does not exist.

- [ ] **Step 3: Add the exact Lucide path data and attribution**

Create `src/components/taskTypeIconData.ts` with the path data copied from the
official Lucide SVG sources. Keep the source names and the ISC license visible
in the file:

```ts
// Source: https://github.com/lucide-icons/lucide/tree/main/icons
// Icons: Lightbulb, Zap, Bookmark, and Check.
// License: ISC. See docs/THIRD_PARTY_NOTICES.md.

export const TASK_TYPE_ICON_PATHS = {
  initiative: [
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
    'M9 18h6',
    'M10 22h4',
  ],
  epic: [
    'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
  ],
  story: [
    'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z',
  ],
  task: ['M20 6 9 17l-5-5'],
  subtask: ['M20 6 9 17l-5-5'],
} as const;
```

Create `docs/THIRD_PARTY_NOTICES.md`:

```md
# Third-party notices

## Lucide icons

The task type icons vendor path data from the Lucide icon set:
https://github.com/lucide-icons/lucide/tree/main/icons

Lucide is available under the ISC License:
https://github.com/lucide-icons/lucide/blob/main/LICENSE

The vendored icons are Lightbulb, Zap, Bookmark, and Check.
```

- [ ] **Step 4: Run the data test to verify it passes**

Run: `npm test -- --run --coverage.enabled=false src/components/taskTypeIconData.test.ts`

Expected: PASS for non-empty source data and the Task/Subtask path reuse.

- [ ] **Step 5: Commit the vendored asset data**

```bash
git add src/components/taskTypeIconData.ts src/components/taskTypeIconData.test.ts docs/THIRD_PARTY_NOTICES.md
git commit -m "feat: vendor task type icon assets"
```

### Task 2: Build and test the depth-to-icon component

**Files:**
- Create: `src/components/TaskTypeIcon.tsx`
- Test: `src/components/TaskTypeIcon.test.tsx`

- [ ] **Step 1: Write the failing mapping and accessibility tests**

Create `src/components/TaskTypeIcon.test.tsx`:

```tsx
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TaskTypeIcon } from './TaskTypeIcon';

afterEach(cleanup);

describe('TaskTypeIcon', () => {
  it.each([
    [1, 'initiative'],
    [2, 'epic'],
    [3, 'story'],
    [4, 'task'],
    [5, 'subtask'],
  ] as const)('maps depth %d to the %s icon class', (depth, type) => {
    const { container } = render(<TaskTypeIcon depth={depth} />);

    const icon = container.querySelector(`.task-type-icon--${type}`);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.querySelector('svg')).not.toBeNull();
  });

  it('falls back to the deepest supported type for an out-of-range depth', () => {
    const { container } = render(<TaskTypeIcon depth={6} />);

    expect(container.querySelector('.task-type-icon--subtask')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
```

- [ ] **Step 2: Run the component tests to verify they fail**

Run: `npm test -- --run --coverage.enabled=false src/components/TaskTypeIcon.test.tsx`

Expected: FAIL because `TaskTypeIcon` does not exist yet.

- [ ] **Step 3: Implement the typed local SVG renderer**

Create `src/components/TaskTypeIcon.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the component tests to verify they pass**

Run: `npm test -- --run --coverage.enabled=false src/components/TaskTypeIcon.test.tsx`

Expected: PASS for all five mappings, fallback behavior, and decorative SVG output.

- [ ] **Step 5: Commit the component**

```bash
git add src/components/TaskTypeIcon.tsx src/components/TaskTypeIcon.test.tsx
git commit -m "feat: render depth-based task icons"
```

### Task 3: Render icons in tree rows and apply Jira-like colors

**Files:**
- Modify: `src/components/TreeRow.tsx:1-250`
- Modify: `src/components/planner.css:105-240`
- Test: `src/components/TreeRow.test.tsx:1-100`

- [ ] **Step 1: Add the failing row integration test**

Add this test to `src/components/TreeRow.test.tsx`:

```tsx
  it('renders the depth-derived icon before the title', () => {
    render(
      <TreeRow
        task={task}
        depth={3}
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

    const row = screen.getByRole('treeitem', { name: 'Initiative' });
    const icon = row.querySelector('.task-type-icon--story');
    const title = screen.getByText('Initiative');

    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon?.compareDocumentPosition(title)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
```

- [ ] **Step 2: Run the row integration test to verify it fails**

Run: `npm test -- --run --coverage.enabled=false src/components/TreeRow.test.tsx -t "renders the depth-derived icon"`

Expected: FAIL because `TreeRow` does not render a `TaskTypeIcon` yet.

- [ ] **Step 3: Render the icon from the existing depth prop**

In `src/components/TreeRow.tsx`, import and render the component immediately
after the drag handle and before the title conditional:

```tsx
import { TaskTypeIcon } from './TaskTypeIcon';
```

```tsx
      <TaskTypeIcon depth={depth} />
      {isEditing ? (
```

- [ ] **Step 4: Add compact layout and Jira-like color tokens**

In `src/components/planner.css`, add these rules after `.task-drag-handle`:

```css
.task-type-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
}

.task-type-icon svg {
  width: 16px;
  height: 16px;
}

.task-type-icon--initiative,
.task-type-icon--epic {
  color: #6554c0;
}

.task-type-icon--story {
  color: #36b37e;
}

.task-type-icon--task {
  color: #0052cc;
}

.task-type-icon--subtask {
  color: #4c9aff;
}
```

- [ ] **Step 5: Run the row suite and complete icon suite**

Run: `npm test -- --run --coverage.enabled=false src/components/TreeRow.test.tsx src/components/TaskTypeIcon.test.tsx src/components/taskTypeIconData.test.ts`

Expected: all row, renderer, and vendored-data tests pass, including dependency indicators and the new integration assertion.

- [ ] **Step 6: Commit the row integration**

```bash
git add src/components/TreeRow.tsx src/components/planner.css src/components/TreeRow.test.tsx
git commit -m "feat: show task type icons in tree rows"
```

### Task 4: Verify the complete planner

**Files:**
- Verify only: all project source, test, and documentation files

- [ ] **Step 1: Run the full quality gate**

Run: `npm run verify`

Expected: Prettier, ESLint, strict TypeScript, all Vitest tests with coverage thresholds, and the Vite production build pass without any network request.

- [ ] **Step 2: Inspect the final worktree**

Run: `git status --short && git log --oneline -6`

Expected: a clean worktree with the vendored icon data, renderer, row integration, tests, notices, and commits visible in recent history.
