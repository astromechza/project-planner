# Filterable Blocker Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Blocked by" native `<select>` with a text `<input>` + `<datalist>` so users can filter candidate blockers by typing instead of scrolling a long dropdown.

**Architecture:** In `DependencyControl` (`src/components/DependencyEditor.tsx`), swap the `<select>` for an `<input list=...>` bound to a native `<datalist>`. Build an ordered `Map<displayText, TaskId>` over the already-sorted candidates, disambiguating duplicate titles with a ` (2)`, ` (3)` suffix. The input holds free text; "Add blocker" resolves the text to a task id via the map and is disabled when no exact match exists.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react + @testing-library/user-event.

---

## File Structure

- Modify: `src/components/DependencyEditor.tsx` — `DependencyControl` component only. New helper `buildCandidateOptions` mapping candidates → ordered `{ displayText, taskId }[]` with duplicate-title suffixing.
- Modify: `src/components/DependencyEditor.test.tsx` — update the two tests that drive the control via `selectOptions`; add a duplicate-title test.
- Maybe modify: `src/components/planner.css` — only if the native input needs box-sizing/appearance tweaks under `input.dependency-control-select`.

No other files change. `onLink`/`onUnlink` interfaces, `DependencyList`, and the exported `DependencyEditor` signature stay identical.

---

## Task 1: Duplicate-title-safe option builder

Introduce a pure helper that turns the sorted candidate ids into display options with unique text, so the datalist values map unambiguously back to task ids.

**Files:**
- Modify: `src/components/DependencyEditor.tsx`
- Test: `src/components/DependencyEditor.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test inside the top-level `describe('DependencyEditor', ...)` block in `src/components/DependencyEditor.test.tsx`. It renders two candidates sharing a title and asserts the datalist exposes disambiguated option values.

```tsx
it('disambiguates duplicate candidate titles in the blocker options', () => {
  const dupA = id('dup-a');
  const dupB = id('dup-b');
  const project: Project = {
    format: 'project-planner/v1',
    name: 'Dup check',
    rootTaskIds: [id('initiative'), dupA, dupB],
    tasks: {
      [id('initiative')]: {
        id: id('initiative'),
        title: 'Initiative',
        parentId: null,
        childIds: [],
      },
      [dupA]: { id: dupA, title: 'Same', parentId: null, childIds: [] },
      [dupB]: { id: dupB, title: 'Same', parentId: null, childIds: [] },
    },
    dependencies: [],
  };

  const { container } = render(
    <DependencyEditor
      project={project}
      selectedTaskId={id('initiative')}
      onLink={vi.fn()}
      onUnlink={vi.fn()}
    />,
  );

  const optionValues = Array.from(
    container.querySelectorAll('datalist option'),
  ).map((option) => option.getAttribute('value'));

  expect(optionValues).toEqual(['Same', 'Same (2)']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DependencyEditor`
Expected: FAIL — no `datalist` element rendered yet (the component still renders a `<select>`), so `optionValues` is `[]`.

- [ ] **Step 3: Implement the option builder and render a datalist**

In `src/components/DependencyEditor.tsx`, add a helper above `DependencyControl`:

```tsx
interface CandidateOption {
  readonly taskId: TaskId;
  readonly displayText: string;
}

function buildCandidateOptions(
  candidateTaskIds: readonly TaskId[],
  project: Project,
): readonly CandidateOption[] {
  const usedCounts = new Map<string, number>();

  return candidateTaskIds.map((taskId) => {
    const title = getTaskTitle(project, taskId);
    const priorCount = usedCounts.get(title) ?? 0;
    usedCounts.set(title, priorCount + 1);
    const displayText = priorCount === 0 ? title : `${title} (${priorCount + 1})`;

    return { taskId, displayText };
  });
}
```

Then replace the body of `DependencyControl` (the whole function from `function DependencyControl({` through its closing `}`) with the datalist-based version:

```tsx
function DependencyControl({
  candidateTaskIds,
  project,
  onAdd,
}: DependencyControlProps): React.JSX.Element {
  const [inputText, setInputText] = useState('');
  const options = buildCandidateOptions(candidateTaskIds, project);
  const optionByText = new Map(
    options.map((option) => [option.displayText, option.taskId]),
  );
  const selectedTaskId = optionByText.get(inputText);
  const listId = 'blocker-options';

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
```

Remove the now-unused `TaskId | ''` union usage; the `useState` import stays. Keep the `useState` import line at the top of the file unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DependencyEditor`
Expected: the new duplicate-title test PASSES. Note: `links the chosen task...` and `clears a pending relationship...` tests will now FAIL because they call `user.selectOptions` on what is no longer a `<select>` — Task 2 fixes them.

- [ ] **Step 5: Commit**

```bash
git add src/components/DependencyEditor.tsx src/components/DependencyEditor.test.tsx
git commit -m "feat: render blocker picker as filterable datalist input"
```

---

## Task 2: Update interaction tests to type-and-add

Convert the two tests that drove the old `<select>` to type into the input instead, matching the new interaction.

**Files:**
- Modify: `src/components/DependencyEditor.test.tsx`

- [ ] **Step 1: Rewrite the "links the chosen task" test**

Replace the existing `it('links the chosen task as the blocker from the Blocked by control', ...)` body's interaction lines. The full test becomes:

```tsx
it('links the chosen task as the blocker from the Blocked by control', async () => {
  const user = userEvent.setup();
  const onLink = vi.fn();
  const project = createProject();

  render(
    <DependencyEditor
      project={project}
      selectedTaskId={id('initiative')}
      onLink={onLink}
      onUnlink={vi.fn()}
    />,
  );

  await user.type(screen.getByLabelText('Blocked by'), 'Epic');
  await user.click(screen.getByRole('button', { name: 'Add blocker' }));

  expect(onLink).toHaveBeenCalledWith(id('epic'), id('initiative'));
});
```

- [ ] **Step 2: Rewrite the "clears a pending relationship" test**

Replace that test's body so it types into the input, then asserts the input clears after the selected task changes (the component is keyed by `selectedTaskId`, so it remounts with empty text):

```tsx
it('clears a pending relationship when the selected task changes', async () => {
  const user = userEvent.setup();
  const project = createProject();
  const { rerender } = render(
    <DependencyEditor
      project={project}
      selectedTaskId={id('initiative')}
      onLink={vi.fn()}
      onUnlink={vi.fn()}
    />,
  );

  await user.type(screen.getByLabelText('Blocked by'), 'Epic');
  rerender(
    <DependencyEditor
      project={project}
      selectedTaskId={id('story')}
      onLink={vi.fn()}
      onUnlink={vi.fn()}
    />,
  );

  expect(screen.getByLabelText('Blocked by')).toHaveValue('');
});
```

- [ ] **Step 3: Fix the "excludes" and "sorts" tests to read datalist options**

These two tests currently query `.querySelectorAll('option')` on the select and expect a leading `'Choose a task'` placeholder. The datalist has no placeholder option. Update both.

For `it('excludes the selected task and existing blocker links from the control', ...)`, replace the three `toHaveTextContent` assertions with datalist value checks:

```tsx
const optionValues = Array.from(
  document.querySelectorAll('datalist option'),
).map((option) => option.getAttribute('value'));

expect(optionValues).toEqual(['Epic']);
```

For `it('sorts the Blocked by options alphanumerically, not by task order', ...)`, replace the option-collection lines and assertion with:

```tsx
const optionValues = Array.from(
  document.querySelectorAll('datalist option'),
).map((option) => option.getAttribute('value'));

expect(optionValues).toEqual(['Apple', 'Zebra']);
```

- [ ] **Step 4: Run the full DependencyEditor suite**

Run: `npm test -- DependencyEditor`
Expected: PASS — all tests, including the Task 1 duplicate-title test, the two rewritten interaction tests, the class-name test, remove-links test, and cycle-warning test.

- [ ] **Step 5: Commit**

```bash
git add src/components/DependencyEditor.test.tsx
git commit -m "test: drive blocker picker via type-and-add"
```

---

## Task 3: Full verification

Confirm the change passes format, lint, types, tests, and build.

**Files:** none (verification only)

- [ ] **Step 1: Run the full verify pipeline**

Run: `npm run verify`
Expected: PASS — `format:check`, `lint`, `typecheck`, `test` (with coverage), and `build` all succeed. If `format:check` fails, run `npx prettier --write src/components/DependencyEditor.tsx src/components/DependencyEditor.test.tsx` and re-run.

- [ ] **Step 2: Manual smoke check (optional)**

Run: `npm run dev`, open the app, select a task, focus the "Blocked by" input, type a partial task title, confirm the browser shows filtered suggestions, pick one, click "Add blocker", confirm it appears in the blocker list.

- [ ] **Step 3: Commit any formatting fixups**

Only if Step 1 required a prettier rewrite:

```bash
git add -A
git commit -m "chore: format blocker picker changes"
```
