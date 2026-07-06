# Local Project Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build a browser-first React planner for one five-level project hierarchy, with keyboard and drag editing, direct blockers, and portable JSON files.

**Architecture:** Pure TypeScript domain functions perform every structural and dependency edit. React renders the tree and inspector through a reducer. Local storage is crash recovery; a versioned JSON file is the portable plan.

**Tech Stack:** Node 24, React, TypeScript, Vite, dnd-kit, native CSS, Vitest, React Testing Library, Playwright, ESLint, typescript-eslint, jsx-a11y, and Prettier.

---

## File structure

- Tooling: .nvmrc, package.json, eslint.config.js, prettier.config.cjs, vite.config.ts, playwright.config.ts.
- Domain: src/domain/types.ts, result.ts, project.ts, tree.ts, dependencies.ts, each with a colocated test.
- Persistence: src/infrastructure/projectFile.ts and recoveryStore.ts, each with a colocated test.
- App: src/app/ProjectApp.tsx and projectReducer.ts with reducer test.
- UI: src/components/AppToolbar.tsx, TreeGrid.tsx, TreeRow.tsx, TaskInspector.tsx, DependencyEditor.tsx, DragController.tsx, planner.css.
- E2E: e2e/planner.spec.ts.

### Task 1: Scaffold strict React toolchain

**Files:**
- Create: .nvmrc, package.json, eslint.config.js, prettier.config.cjs, vite.config.ts, src/main.tsx, src/test/setup.ts, src/app/ProjectApp.tsx, src/components/planner.css

- [ ] **Step 1: Scaffold and install exact dependencies**

~~~bash
npm create vite@latest . -- --template react-ts
npm install --save-exact @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install --save-dev --save-exact @playwright/test @testing-library/jest-dom @testing-library/react @testing-library/user-event @vitest/coverage-v8 eslint-config-prettier eslint-plugin-jsx-a11y jsdom prettier vitest
npm pkg set engines.node=">=24 <25"
npm pkg set scripts.lint="eslint ."
npm pkg set scripts.format:check="prettier --check ."
npm pkg set scripts.typecheck="tsc -b"
npm pkg set scripts.test="vitest run --coverage"
npm pkg set scripts.e2e="playwright test"
npm pkg set scripts.verify="npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build"
printf '24\n' > .nvmrc
~~~

Expected: package lock is present and direct package versions have no range prefix.

- [ ] **Step 2: Configure strict checks**

Enable TypeScript strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess, noImplicitReturns, noFallthroughCasesInSwitch, noUnusedLocals, noUnusedParameters, and verbatimModuleSyntax. Configure ESLint flat config with typescript-eslint strict type checked rules and project service, React Hooks, jsx-a11y, and no-explicit-any as an error. Configure Prettier with single quotes and trailing commas.

- [ ] **Step 3: Configure test coverage and prove the toolchain**

Configure Vite test for jsdom with a test setup importing jest-dom. Set V8 coverage thresholds of 90% for all measures over src/domain and src/infrastructure. Render a compile-only ProjectApp main landmark under StrictMode.

~~~bash
npm run verify
git add .
git commit -m "chore: scaffold strict React planner"
~~~

Expected: all checks pass.

### Task 2: Define the project model

**Files:**
- Create: src/domain/types.ts, src/domain/result.ts, src/domain/project.ts, src/domain/project.test.ts

- [ ] **Step 1: Write failing model test**

~~~ts
expect(createEmptyProject('Roadmap')).toMatchObject({
  format: 'project-planner/v1', name: 'Roadmap', rootTaskIds: [], tasks: {}, dependencies: [],
});
expect(getTaskDepth(projectWithOneInitiative, initiativeId)).toBe(1);
expect(getTaskType(projectWithOneInitiative, initiativeId)).toBe('Initiative');
~~~

- [ ] **Step 2: Verify failure**

~~~bash
npm run test -- src/domain/project.test.ts
~~~

Expected: FAIL because domain files are absent.

- [ ] **Step 3: Implement model**

Define branded TaskId; TaskType values Initiative, Epic, Story, Task, Subtask; PlanTask fields id/title/parentId/childIds/optional notes; Dependency fields blockerId/blockedId; and Project fields format/name/rootTaskIds/tasks/dependencies. Define Result as an ok/value or ok false/error discriminated union. Implement createEmptyProject, getTaskDepth, and getTaskType. Type is derived from depth and never persisted.

- [ ] **Step 4: Verify and commit**

~~~bash
npm run test -- src/domain/project.test.ts
npm run typecheck
git add src/domain
git commit -m "feat: add planner domain model"
~~~

### Task 3: Implement immutable, depth-safe tree operations

**Files:**
- Create: src/domain/tree.ts, src/domain/tree.test.ts

- [ ] **Step 1: Write failing operation tests**

~~~ts
expect(addTask(createEmptyProject('Roadmap'), null, 'Launch').ok).toBe(true);
expect(addTask(projectWithDepth(5), deepestId, 'Too deep'))
  .toEqual({ ok: false, error: 'MAX_DEPTH_EXCEEDED' });
expect(moveTask(projectWithTwoRoots(), firstId, { parentId: null, index: 2 }).value.rootTaskIds)
  .toEqual([secondId, firstId]);
expect(moveTask(projectWithParentChild(), parentId, { parentId: childId, index: 0 }))
  .toEqual({ ok: false, error: 'CYCLE' });
~~~

Also test that moving retains descendants, deletion removes the whole subtree, and deletion removes every incident dependency.

- [ ] **Step 2: Verify failure**

~~~bash
npm run test -- src/domain/tree.test.ts
~~~

- [ ] **Step 3: Implement exact public API**

~~~ts
export function addTask(project: Project, parentId: TaskId | null, title: string): Result<{ project: Project; task: PlanTask }, TreeError>;
export function moveTask(project: Project, taskId: TaskId, target: { parentId: TaskId | null; index: number }): Result<Project, TreeError>;
export function updateTask(project: Project, taskId: TaskId, patch: Pick<PlanTask, 'title' | 'notes'>): Result<Project, 'TASK_NOT_FOUND'>;
export function deleteTask(project: Project, taskId: TaskId): Result<Project, 'TASK_NOT_FOUND'>;
~~~

Use one crypto.randomUUID helper. Clone only changed records/arrays. Validate target existence, index, self and descendant targets, then target depth plus moved subtree height before changing state. Return named errors, never throw for invalid planner operations.

- [ ] **Step 4: Test Tab and Shift+Tab mappings, then commit**

Test Tab as move under preceding sibling and Shift+Tab as move immediately after parent in grandparent.

~~~bash
npm run test -- src/domain/tree.test.ts
git add src/domain/tree.ts src/domain/tree.test.ts
git commit -m "feat: add immutable task tree operations"
~~~

### Task 4: Add dependencies and cycle detection

**Files:**
- Create: src/domain/dependencies.ts, src/domain/dependencies.test.ts

- [ ] **Step 1: Write failing tests**

~~~ts
expect(linkDependency(project, alphaId, betaId).ok).toBe(true);
expect(linkDependency(project, alphaId, alphaId)).toEqual({ ok: false, error: 'SELF_DEPENDENCY' });
expect(linkDependency(withAlphaBlocksBeta, alphaId, betaId)).toEqual({ ok: false, error: 'DUPLICATE_DEPENDENCY' });
expect(getBlockedBy(withAlphaBlocksBeta, betaId)).toEqual([alphaId]);
expect(getBlocks(withAlphaBlocksBeta, alphaId)).toEqual([betaId]);
expect(findDependencyCycles(projectWithCycle())).toEqual([[alphaId, betaId, alphaId]]);
~~~

- [ ] **Step 2: Implement and verify**

Export linkDependency, unlinkDependency, getBlocks, getBlockedBy, and findDependencyCycles. Link checks endpoint existence, self link, and duplicate. Cycle detection uses depth-first traversal over blocker to blocked edges. It reports cycles but permits them.

~~~bash
npx vitest run src/domain/dependencies.test.ts --coverage=false
git add src/domain/dependencies.ts src/domain/dependencies.test.ts
git commit -m "feat: add blocker dependency operations"
~~~

### Task 5: Add validated JSON and recovery storage

**Files:**
- Create: src/infrastructure/projectFile.ts, src/infrastructure/projectFile.test.ts, src/infrastructure/recoveryStore.ts, src/infrastructure/recoveryStore.test.ts

- [ ] **Step 1: Write failing parser tests**

~~~ts
expect(parseProjectFile(JSON.stringify(sampleProject))).toEqual({ ok: true, value: sampleProject });
expect(parseProjectFile('{')).toEqual({ ok: false, error: 'INVALID_JSON' });
expect(parseProjectFile(JSON.stringify({ format: 'project-planner/v2' })))
  .toEqual({ ok: false, error: 'UNSUPPORTED_FORMAT' });
expect(parseProjectFile(JSON.stringify({ format: 'project-planner/v1', tasks: [] })))
  .toEqual({ ok: false, error: 'INVALID_PROJECT' });
expect(serializeProjectFile(sampleProject)).toBe(JSON.stringify(sampleProject, null, 2));
~~~

Use a fake Storage to prove recovery save/load and corrupt recovery returning null.

- [ ] **Step 2: Implement validation**

Parse JSON into unknown. Validate format, name, root array, task map and fields, dependency endpoints, parent/child consistency, root consistency, and depth no greater than five without unsafe assertions. Return INVALID_JSON, UNSUPPORTED_FORMAT, or INVALID_PROJECT. Serialize keys in format/name/rootTaskIds/tasks/dependencies order. Recovery uses exactly one key: project-planner/recovery/v1.

- [ ] **Step 3: Verify and commit**

~~~bash
npx vitest run src/infrastructure/projectFile.test.ts src/infrastructure/recoveryStore.test.ts --coverage=false
git add src/infrastructure
git commit -m "feat: add validated plan persistence"
~~~

### Task 6: Build app state, toolbar, and inspector

**Files:**
- Create: src/app/projectReducer.ts, src/app/projectReducer.test.ts, src/ErrorBoundary.tsx, src/components/AppToolbar.tsx, src/components/TaskInspector.tsx
- Modify: src/app/ProjectApp.tsx, src/main.tsx, src/components/planner.css

- [ ] **Step 1: Write reducer failures**

~~~ts
expect(reduce(initialState, { type: 'SELECT_TASK', taskId })).toMatchObject({ selectedTaskId: taskId });
expect(reduce(initialState, { type: 'CREATE_TASK', parentId: null, title: 'Launch' }).project.rootTaskIds).toHaveLength(1);
expect(reduce(stateWithTask, { type: 'UPDATE_TASK', taskId, patch: { title: 'Renamed' } }).project.tasks[taskId].title).toBe('Renamed');
expect(reduce(initialState, { type: 'IMPORT_FAILED', error: 'INVALID_PROJECT' }).error).toBe('INVALID_PROJECT');
~~~

- [ ] **Step 2: Implement state and persistence boundary**

Use state project/selectedTaskId/error and discriminated actions for select, create, update, move, delete, link, unlink, import success/failure. Reducer delegates to domain functions. ProjectApp loads recovery lazily and saves recovery in an effect, never inside the reducer. Toolbar confirms New plan for non-empty plans, imports through File.text and parser, and exports Blob object URLs then revokes them. Inspector uses labelled title and notes fields, shows derived type, disables Add child for Subtask, and confirms destructive delete with children or dependency links.

- [ ] **Step 3: Implement error recovery and commit**

The ErrorBoundary fallback states that recovery exists and offers Reload planner. Wrap ProjectApp in main.tsx.

~~~bash
npx vitest run src/app/projectReducer.test.ts --coverage=false
npm run build
git add src/app src/components/AppToolbar.tsx src/components/TaskInspector.tsx src/components/planner.css src/ErrorBoundary.tsx src/main.tsx
git commit -m "feat: add planner application shell"
~~~

### Task 7: Render accessible keyboard hierarchy

**Files:**
- Create: src/components/TreeGrid.tsx, src/components/TreeRow.tsx, src/components/TreeGrid.test.tsx
- Modify: src/app/ProjectApp.tsx, src/components/planner.css

- [ ] **Step 1: Write keyboard test**

~~~tsx
await user.click(screen.getByRole('treeitem', { name: /launch/i }));
await user.keyboard('{ArrowRight}');
expect(screen.getByRole('treeitem', { name: /foundation/i })).toBeVisible();
await user.keyboard('{Enter}');
expect(onCreateSibling).toHaveBeenCalledWith(launchId);
await user.keyboard('{Tab}');
expect(onIndent).toHaveBeenCalledWith(storyId);
await user.keyboard('{Shift>}{Tab}{/Shift}');
expect(onOutdent).toHaveBeenCalledWith(taskId);
~~~

- [ ] **Step 2: Implement tree semantics**

Depth-first flatten visible rows, skipping collapsed descendants. Use role tree/treeitem, aria-level, aria-expanded only for parents, and roving tab index. ArrowUp/Down select visible neighbours; ArrowRight expands or selects first child; ArrowLeft collapses or selects parent; Enter creates a sibling; Tab/Shift+Tab call Task 3 operations; Escape cancels inline title edit. Use labelled Task title input.

- [ ] **Step 3: Add density, responsive behaviour, verify and commit**

Use 36px rows, 24px indentation, a 3px focus outline, and custom colours. At 320px place inspector under tree.

~~~bash
npm run test -- src/components/TreeGrid.test.tsx
git add src/components/TreeGrid.tsx src/components/TreeRow.tsx src/components/TreeGrid.test.tsx src/app/ProjectApp.tsx src/components/planner.css
git commit -m "feat: add keyboard project tree"
~~~

### Task 8: Add blocker editor and highlight states

**Files:**
- Create: src/components/DependencyEditor.tsx, src/components/DependencyEditor.test.tsx
- Modify: src/components/TaskInspector.tsx, src/components/TreeGrid.tsx, src/components/TreeRow.tsx, src/components/planner.css

- [ ] **Step 1: Write direct-link UI test**

~~~tsx
await user.selectOptions(screen.getByLabelText('Blocks'), betaId);
await user.click(screen.getByRole('button', { name: 'Add blocker link' }));
expect(onLink).toHaveBeenCalledWith(alphaId, betaId);
expect(screen.getByRole('treeitem', { name: /alpha/i })).toHaveClass('task-row--blocks-selected');
expect(screen.getByText(/dependency cycle detected/i)).toBeVisible();
~~~

- [ ] **Step 2: Implement and commit**

Exclude self and existing links. Blocks creates selected to chosen; Blocked by creates chosen to selected. Add accessible remove-link controls. Row classes are selected blue, selected prerequisite amber, and selected dependant red/orange. Surface cycles in inspector.

~~~bash
npx vitest run src/components/DependencyEditor.test.tsx src/components/TreeGrid.test.tsx --coverage.enabled=false
git add src/components
git commit -m "feat: add blocker editing and highlighting"
~~~

### Task 9: Add deliberate drag/reparent zones

**Files:**
- Create: src/components/DragController.tsx, src/components/DragController.test.tsx
- Modify: src/components/TreeGrid.tsx, src/components/TreeRow.tsx, src/components/planner.css

- [ ] **Step 1: Test resolver before rendering**

~~~ts
expect(resolveDropTarget(activeId, targetId, 'before', project)).toEqual({ ok: true, value: { parentId: null, index: 0 } });
expect(resolveDropTarget(activeId, targetId, 'after', project)).toEqual({ ok: true, value: { parentId: null, index: 2 } });
expect(resolveDropTarget(activeId, targetId, 'child', project)).toEqual({ ok: true, value: { parentId: targetId, index: 0 } });
expect(resolveDropTarget(parentId, childId, 'child', project)).toEqual({ ok: false, error: 'CYCLE' });
~~~

- [ ] **Step 2: Implement dnd-kit controller**

Use DndContext, PointerSensor activation distance 8, KeyboardSensor with sortableKeyboardCoordinates, and labelled drag handles. During drag render before, child, and after droppables with screen-reader labels and visible active border. Resolver computes parent/index then calls moveTask; null or failed drops leave state unchanged and write an alert message.

- [ ] **Step 3: Verify and commit**

~~~bash
npm run test -- src/components/DragController.test.tsx
npm run test
git add src/components
git commit -m "feat: add planner drag and drop"
~~~

### Task 10: Verify complete local workflow

**Files:**
- Create: playwright.config.ts, e2e/planner.spec.ts, README.md

- [ ] **Step 1: Write one browser journey**

Use accessible names to create Initiative Launch, add Epic Foundation, link a blocker, verify the highlight, export, reload and confirm recovery, create new plan, import the downloaded JSON, and confirm Foundation remains.

- [ ] **Step 2: Configure and run E2E**

Use a Playwright web server command npm run dev -- --host 127.0.0.1 and base URL http://127.0.0.1:5173.

~~~bash
npx playwright install chromium
npm run e2e
~~~

Expected: PASS. Add any missing accessibility labels rather than weakening assertions.

- [ ] **Step 3: Document and final verify**

README covers Node 24, npm ci, dev start, verify/e2e commands, keyboard controls, derived types, recovery, and JSON limitations.

~~~bash
npm run verify
npm run e2e
git status --short
git add README.md playwright.config.ts e2e/planner.spec.ts
git commit -m "test: verify local planner workflow"
~~~

## Spec coverage review

- Tree creation, derived types, reparenting, and keyboard controls: Tasks 2, 3, 7, 9.
- Blockers, highlights, and cycles: Tasks 4 and 8.
- Safe JSON and recovery: Task 5 and E2E in Task 10.
- Inspector, destructive confirmation, accessible responsive UI: Tasks 6 through 9.
- Strict typing, validation, static analysis, coverage, and repeatable CI: Tasks 1 and 10.
