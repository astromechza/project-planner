# Story Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist optional story-point estimates, aggregate them across descendants, edit them in the inspector, and show positive totals in tree-row bubbles.

**Architecture:** Define a literal `StoryPoints` union and validation helper in the domain model. A pure recursive `getStoryPointsTotal` helper computes subtree totals; `TreeGrid` passes each total to `TreeRow`, avoiding denormalized state. The inspector updates the existing reducer path, and project-file parsing/serialization remains backward-compatible with `project-planner/v1`.

**Tech Stack:** React 19, TypeScript strict mode, Vitest, Testing Library, Vite.

---

### Task 1: Add story-point types, validation, and recursive totals

**Files:**
- Modify: `src/domain/types.ts:1-30`
- Modify: `src/domain/tree.ts:1-30`
- Create: `src/domain/storyPoints.ts`
- Test: `src/domain/storyPoints.test.ts`
- Test: `src/domain/tree.test.ts:230-255`

- [ ] **Step 1: Write failing domain tests**

Create `src/domain/storyPoints.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getStoryPointsTotal, isStoryPoints } from './storyPoints';
import type { PlanTask, Project, TaskId } from './types';

const id = (value: string): TaskId => value as TaskId;

const task = (
  taskId: string,
  parentId: TaskId | null,
  childIds: readonly TaskId[],
  storyPoints?: 1 | 3 | 5 | 7 | 14,
): PlanTask => ({
  id: id(taskId),
  title: taskId,
  parentId,
  childIds,
  ...(storyPoints === undefined ? {} : { storyPoints }),
});

describe('story points', () => {
  it.each([1, 3, 5, 7, 14])('accepts %d as a story-point value', (value) => {
    expect(isStoryPoints(value)).toBe(true);
  });

  it.each([0, 2, 6, 8, 15, '5', null])(
    'rejects %p as a story-point value',
    (value) => {
      expect(isStoryPoints(value)).toBe(false);
    },
  );

  it('sums the selected task and all descendants once', () => {
    const root = id('root');
    const child = id('child');
    const grandchild = id('grandchild');
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Points',
      rootTaskIds: [root],
      tasks: {
        [root]: task('root', null, [child], 3),
        [child]: task('child', root, [grandchild], 5),
        [grandchild]: task('grandchild', child, [], 14),
      },
      dependencies: [],
    };

    expect(getStoryPointsTotal(project, root)).toBe(22);
    expect(getStoryPointsTotal(project, child)).toBe(19);
  });
});
```

Add to the existing tree update test:

```tsx
    const updated = expectSuccess(
      updateTask(initial, initiative, { storyPoints: 7 }),
    );
    expect(updated.tasks[initiative]?.storyPoints).toBe(7);
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- --run --coverage.enabled=false src/domain/storyPoints.test.ts src/domain/tree.test.ts -t "story points|storyPoints"`

Expected: FAIL because the story-point types, helper, and update field do not exist.

- [ ] **Step 3: Add the domain types and helper**

In `src/domain/types.ts`, add:

```ts
export const STORY_POINT_OPTIONS = [1, 3, 5, 7, 14] as const;
export type StoryPoints = (typeof STORY_POINT_OPTIONS)[number];
```

Add `readonly storyPoints?: StoryPoints;` to `PlanTask`.

Create `src/domain/storyPoints.ts`:

```ts
import type { Project, StoryPoints, TaskId } from './types';

export const isStoryPoints = (value: unknown): value is StoryPoints =>
  value === 1 || value === 3 || value === 5 || value === 7 || value === 14;

export const getStoryPointsTotal = (
  project: Project,
  taskId: TaskId,
  visited = new Set<TaskId>(),
): number => {
  if (visited.has(taskId)) {
    return 0;
  }

  const task = project.tasks[taskId];
  if (task === undefined) {
    return 0;
  }

  visited.add(taskId);
  return (
    (task.storyPoints ?? 0) +
    task.childIds.reduce(
      (total, childId) => total + getStoryPointsTotal(project, childId, visited),
      0,
    )
  );
};
```

Add `readonly storyPoints?: StoryPoints;` to `TaskUpdate` in `src/domain/tree.ts`.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- --run --coverage.enabled=false src/domain/storyPoints.test.ts src/domain/tree.test.ts -t "story points|storyPoints"`

Expected: PASS for allowed values, subtree totals, and updates.

- [ ] **Step 5: Commit the domain change**

```bash
git add src/domain/types.ts src/domain/tree.ts src/domain/storyPoints.ts src/domain/storyPoints.test.ts src/domain/tree.test.ts
git commit -m "feat: add story point domain model"
```

### Task 2: Validate and round-trip story points in project files

**Files:**
- Modify: `src/infrastructure/projectFile.ts:45-70,254-265`
- Test: `src/infrastructure/projectFile.test.ts:30-145`

- [ ] **Step 1: Write failing import/export tests**

Add to `src/infrastructure/projectFile.test.ts`:

```tsx
  it('round-trips assigned story points and preserves legacy tasks without them', () => {
    const projectWithPoints: Project = {
      ...project,
      tasks: {
        ...project.tasks,
        [initiativeId]: { ...project.tasks[initiativeId], storyPoints: 14 },
      },
    };

    expect(parseProjectFile(serializeProjectFile(projectWithPoints))).toEqual({
      ok: true,
      value: projectWithPoints,
    });
    expect(parseProjectFile(serializeProjectFile(project))).toEqual({
      ok: true,
      value: project,
    });
  });

  it.each([0, 2, 6, 8, 15, '5'])('rejects invalid task story points %p', (value) => {
    const invalidTasks = {
      ...project.tasks,
      [epicId]: { ...project.tasks[epicId], storyPoints: value },
    };

    expect(
      parseProjectFile(JSON.stringify({ ...project, tasks: invalidTasks })),
    ).toEqual({ ok: false, error: 'INVALID_PROJECT' });
  });
```

- [ ] **Step 2: Run the focused file tests to verify they fail**

Run: `npm test -- --run --coverage.enabled=false src/infrastructure/projectFile.test.ts -t "story points"`

Expected: FAIL because parsing does not preserve or validate `storyPoints`.

- [ ] **Step 3: Implement backward-compatible parsing**

Import `isStoryPoints` from `../domain/storyPoints` and add to `parseTask`:

```ts
  if (
    value.storyPoints !== undefined &&
    !isStoryPoints(value.storyPoints)
  ) {
    return undefined;
  }
```

Build the returned task with the optional field only when present:

```ts
  return value.storyPoints === undefined
    ? value.notes === undefined
      ? { id, title: value.title, parentId, childIds }
      : { id, title: value.title, parentId, childIds, notes: value.notes }
    : {
        id,
        title: value.title,
        parentId,
        childIds,
        ...(value.notes === undefined ? {} : { notes: value.notes }),
        storyPoints: value.storyPoints,
      };
```

`serializeProjectFile` already serializes task objects, so defined story points
will be exported without changing the file format version.

- [ ] **Step 4: Run the focused file tests to verify they pass**

Run: `npm test -- --run --coverage.enabled=false src/infrastructure/projectFile.test.ts -t "story points"`

Expected: PASS for assigned values, legacy tasks, and invalid-value rejection.

- [ ] **Step 5: Commit persistence support**

```bash
git add src/infrastructure/projectFile.ts src/infrastructure/projectFile.test.ts
git commit -m "feat: persist and validate story points"
```

### Task 3: Add story-point editing to the inspector

**Files:**
- Modify: `src/components/TaskInspector.tsx:45-80`
- Test: `src/app/projectReducer.test.ts:50-80`
- Test: `src/app/ProjectApp.test.tsx:1-120`

- [ ] **Step 1: Add failing reducer and inspector interaction coverage**

Add a reducer assertion that dispatching `{ type: 'update', taskId, update: { storyPoints: 7 } }` stores `7` on the selected task.

Add an app interaction test that selects a task, changes `screen.getByLabelText('Story points')` to `'14'`, and expects the selected task inspector to retain `14` after the update.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- --run --coverage.enabled=false src/app/projectReducer.test.ts src/app/ProjectApp.test.tsx -t "story points|Story points"`

Expected: FAIL because the inspector has no Story points control and the task type does not yet include the field.

- [ ] **Step 3: Add the controlled Story points select**

In `src/components/TaskInspector.tsx`, import `STORY_POINT_OPTIONS` and
`isStoryPoints` from `../domain/storyPoints`, then add after the Notes field:

```tsx
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
```

- [ ] **Step 4: Run the focused inspector tests to verify they pass**

Run: `npm test -- --run --coverage.enabled=false src/app/projectReducer.test.ts src/app/ProjectApp.test.tsx -t "story points|Story points"`

Expected: PASS for assigning and clearing story points through the existing update pathway.

- [ ] **Step 5: Commit inspector editing**

```bash
git add src/components/TaskInspector.tsx src/app/projectReducer.test.ts src/app/ProjectApp.test.tsx
git commit -m "feat: edit story points in task inspector"
```

### Task 4: Show aggregate story points in tree rows

**Files:**
- Create: `src/components/StoryPointsIndicator.tsx`
- Test: `src/components/StoryPointsIndicator.test.tsx`
- Modify: `src/components/TreeRow.tsx:1-280`
- Modify: `src/components/TreeGrid.tsx:1-460`
- Modify: `src/components/planner.css:250-300`
- Test: `src/components/TreeGrid.test.tsx:1-120`

- [ ] **Step 1: Write failing indicator and tree-total tests**

Create indicator tests for `total={0}` rendering nothing and `total={22}` rendering `role="img"`, text `22`, and `aria-label="22 story points"`.

Add a TreeGrid test project with a root worth `3`, a child worth `5`, and a grandchild worth `14`; assert the root row shows `22 story points`, child shows `19 story points`, and the grandchild shows `14 story points`.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- --run --coverage.enabled=false src/components/StoryPointsIndicator.test.tsx src/components/TreeGrid.test.tsx -t "story points|Story points"`

Expected: FAIL because the indicator and aggregate row prop do not exist.

- [ ] **Step 3: Implement the indicator and wire aggregate totals**

Create `src/components/StoryPointsIndicator.tsx`:

```tsx
interface StoryPointsIndicatorProps {
  readonly total: number;
}

export function StoryPointsIndicator({
  total,
}: StoryPointsIndicatorProps): React.JSX.Element | null {
  if (total <= 0) {
    return null;
  }

  return (
    <span
      className="story-points-indicator"
      role="img"
      aria-label={`${total} story points`}
    >
      {total}
    </span>
  );
}
```

Add `readonly storyPointsTotal: number;` to `TreeRowProps`, render
`<StoryPointsIndicator total={storyPointsTotal} />` after the notes indicator,
and pass `storyPointsTotal={getStoryPointsTotal(project, task.id)}` from
`TreeGrid`. Update direct `TreeRow` test fixtures with `storyPointsTotal={0}`.

- [ ] **Step 4: Add compact bubble styling**

In `src/components/planner.css`, add:

```css
.story-points-indicator {
  flex: 0 0 auto;
  min-width: 1.5rem;
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
  color: #172b4d;
  background: #deebff;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
```

- [ ] **Step 5: Run the focused row and indicator suites**

Run: `npm test -- --run --coverage.enabled=false src/components/StoryPointsIndicator.test.tsx src/components/TreeGrid.test.tsx src/components/TreeRow.test.tsx`

Expected: PASS for direct totals, nested totals, zero omission, and existing row behavior.

- [ ] **Step 6: Commit row aggregation and display**

```bash
git add src/components/StoryPointsIndicator.tsx src/components/StoryPointsIndicator.test.tsx src/components/TreeRow.tsx src/components/TreeGrid.tsx src/components/planner.css src/components/TreeGrid.test.tsx src/components/TreeRow.test.tsx
git commit -m "feat: show aggregate story points in task rows"
```

### Task 5: Verify the complete planner

**Files:**
- Verify only: all project source, test, and documentation files

- [ ] **Step 1: Run the full quality gate**

Run: `npm run verify`

Expected: Prettier, ESLint, strict TypeScript, all Vitest tests with coverage thresholds, and the Vite production build pass.

- [ ] **Step 2: Inspect the final worktree**

Run: `git status --short && git log --oneline -7`

Expected: a clean worktree with the story-point domain, persistence, inspector, aggregation, row indicator, tests, and commits visible in recent history.
