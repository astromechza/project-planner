# Shortcut Contract Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `?` actionable from the empty planner tree and move next-sibling creation from Enter to Shift+Enter.

**Architecture:** Keep shortcut dispatch in `TreeGrid`, extending the existing tree focus model to the empty state. Change only the tree-row structural-creation branch and the shared shortcut-description data; title-edit and drag/drop Enter behavior remain unchanged.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library.

---

### Task 1: Revise tree focus and keyboard contract

**Files:**
- Modify: `src/components/TreeGrid.tsx`, `src/components/TreeGrid.test.tsx`
- Modify: `src/components/KeyboardShortcutsDialog.tsx`, `src/components/KeyboardShortcutsDialog.test.tsx`

- [ ] **Step 1: Write failing shortcut regressions**

Add exact tests:

```tsx
const emptyTree = screen.getByRole('tree', { name: 'Project task tree' });
emptyTree.focus();
fireEvent.keyDown(emptyTree, { key: '?' });
expect(onShowShortcuts).toHaveBeenCalledWith(emptyTree);

fireEvent.keyDown(story, { key: 'Enter' });
expect(onCreateSibling).not.toHaveBeenCalled();
fireEvent.keyDown(story, { key: 'Enter', shiftKey: true });
expect(onCreateSibling).toHaveBeenCalledWith(storyId, 2);
```

Assert the dialog displays `Shift` + `Enter` for next sibling and retains
plain Enter for title saving and drag drop.

- [ ] **Step 2: Run focused tests and observe failure**

```bash
npx vitest run src/components/TreeGrid.test.tsx src/components/KeyboardShortcutsDialog.test.tsx --coverage=false
```

Expected: FAIL because the empty tree is not a focusable shortcut opener and
plain Enter still creates a sibling.

- [ ] **Step 3: Implement the minimal contract change**

Make the empty `role="tree"` focusable with `tabIndex={0}` and add a
tree-container `onKeyDown` that opens shortcuts for `event.key === '?'` only
when the tree itself owns focus and no task row is present. Preserve the
current task-row path and input/drag-handle guards.

In the tree-row `Enter` branch, return without action unless
`event.shiftKey` is true; when true, preserve the existing direct-after
sibling insertion. Change the shared dialog data entry from `['Enter']` to
`['Shift', 'Enter']` for `Create the next sibling`.

- [ ] **Step 4: Run full verification and commit**

```bash
npm run verify
git add src/components/TreeGrid.tsx src/components/TreeGrid.test.tsx src/components/KeyboardShortcutsDialog.tsx src/components/KeyboardShortcutsDialog.test.tsx
git commit -m "fix: revise planner creation shortcuts"
```

Expected: focused regressions and the full gate pass. The existing browser
workflow need not run again because the changed keys are covered by component
tests and its port is intentionally reserved by the user's live app.

## Spec coverage review

- Empty-tree `?` activation and focusability: Task 1 regression and tree
  container handler.
- Shift+Enter next-sibling creation and inert plain Enter: Task 1 regression
  and tree-row branch.
- Accurate visible shortcut descriptions: Task 1 dialog test and shared data
  update.
