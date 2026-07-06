# Title Edit Keyboard Shortcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a focused task row enter inline title editing with `E`, and make that command discoverable in the keyboard-shortcuts modal.

**Architecture:** Keep title-edit state inside `TreeRow`, where the inline input already lives. `TreeRow` intercepts unmodified `e` only when the tree-item element itself is focused, starts the existing edit flow, and delegates all other keypresses to `TreeGrid`. A one-time `useEffect` focuses and selects the title input on edit entry so typing is not re-selected on every state update.

**Tech Stack:** React 19, TypeScript strict mode, Vitest, Testing Library, Vite.

---

### Task 1: Start and focus title editing from a task row

**Files:**
- Modify: `src/components/TreeRow.tsx:1-205`
- Test: `src/components/TreeGrid.test.tsx:434-465`

- [ ] **Step 1: Write the failing tree interaction test**

Add this test immediately before the existing Shift+Enter test in `src/components/TreeGrid.test.tsx`:

```tsx
  it('starts and selects an inline title edit with E on a focused task row', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'e' });

    const titleInput = screen.getByRole('textbox', { name: 'Task title' });
    expect(titleInput).toHaveFocus();
    expect(titleInput).toHaveValue('Initiative');
    expect(titleInput.selectionStart).toBe(0);
    expect(titleInput.selectionEnd).toBe('Initiative'.length);
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run src/components/TreeGrid.test.tsx -t "starts and selects an inline title edit with E"`

Expected: FAIL because no title input is created after the `e` keypress.

- [ ] **Step 3: Add an explicit edit-entry helper and one-time input focus/selection**

In `src/components/TreeRow.tsx`, change the React imports to:

```tsx
import { useEffect, useId, useRef, useState } from 'react';
```

After the two existing title state declarations, add:

```tsx
  const titleInputRef = useRef<HTMLInputElement>(null);
```

After `cancelEditing`, add:

```tsx
  const startEditing = (): void => {
    setDraftTitle(task.title);
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditing]);
```

Replace the tree item `onKeyDown` prop with:

```tsx
      onKeyDown={(event) => {
        if (
          event.key === 'e' &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          event.target === event.currentTarget &&
          document.activeElement === event.currentTarget
        ) {
          event.preventDefault();
          startEditing();
          return;
        }

        onKeyDown(event);
      }}
```

Replace the input ref callback with the stable ref:

```tsx
          ref={titleInputRef}
```

Replace the double-click state changes with:

```tsx
          onDoubleClick={startEditing}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run src/components/TreeGrid.test.tsx -t "starts and selects an inline title edit with E"`

Expected: PASS.

- [ ] **Step 5: Add negative coverage for modified keys**

Add this test directly after the edit-entry test:

```tsx
  it('does not start title editing for modified E keypresses', () => {
    render(<TreeHarness />);

    const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
    fireEvent.click(initiative);
    fireEvent.keyDown(initiative, { key: 'E', shiftKey: true });
    fireEvent.keyDown(initiative, { key: 'e', ctrlKey: true });

    expect(
      screen.queryByRole('textbox', { name: 'Task title' }),
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 6: Run the complete tree suite**

Run: `npm test -- --run src/components/TreeGrid.test.tsx`

Expected: PASS, including existing Enter, Escape, Tab, pointer title-edit, and drag handling coverage.

- [ ] **Step 7: Commit the task**

```bash
git add src/components/TreeRow.tsx src/components/TreeGrid.test.tsx
git commit -m "feat: add title edit keyboard shortcut"
```

### Task 2: Document the edit-entry key in the modal

**Files:**
- Modify: `src/components/KeyboardShortcutsDialog.tsx:30-38`
- Test: `src/components/KeyboardShortcutsDialog.test.tsx:86-101`

- [ ] **Step 1: Write the failing shortcut-definition assertion**

Add to `distinguishes title-edit and drag-handle shortcuts from tree controls`:

```tsx
    expect(SHORTCUT_GROUPS[1]?.shortcuts).toContainEqual({
      keys: ['E'],
      description: 'Edit title',
    });
```

- [ ] **Step 2: Run the focused dialog test to verify it fails**

Run: `npm test -- --run src/components/KeyboardShortcutsDialog.test.tsx -t "distinguishes title-edit"`

Expected: FAIL because the edit-structure group does not contain `E — Edit title`.

- [ ] **Step 3: Add the shared shortcut definition**

In `src/components/KeyboardShortcutsDialog.tsx`, insert this entry before `Shift+Enter` in the `Edit structure` group:

```tsx
      { keys: ['E'], description: 'Edit title' },
```

- [ ] **Step 4: Run the focused dialog test to verify it passes**

Run: `npm test -- --run src/components/KeyboardShortcutsDialog.test.tsx -t "distinguishes title-edit"`

Expected: PASS.

- [ ] **Step 5: Run the complete dialog suite**

Run: `npm test -- --run src/components/KeyboardShortcutsDialog.test.tsx`

Expected: PASS, including every documented key rendered as a `<kbd>` element.

- [ ] **Step 6: Commit the task**

```bash
git add src/components/KeyboardShortcutsDialog.tsx src/components/KeyboardShortcutsDialog.test.tsx
git commit -m "docs: show title edit shortcut"
```

### Task 3: Verify the planner quality gates

**Files:**
- Verify only: all project source and test files

- [ ] **Step 1: Run the complete verification command**

Run: `npm run verify`

Expected: all Vitest suites pass, coverage thresholds pass, ESLint reports no errors, TypeScript typecheck passes, and the production Vite build succeeds.

- [ ] **Step 2: Inspect the final state**

Run: `git status --short && git log --oneline -3`

Expected: a clean worktree with the two task commits and the committed shortcut specification present in recent history.
