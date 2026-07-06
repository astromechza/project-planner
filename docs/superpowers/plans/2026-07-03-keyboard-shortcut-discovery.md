# Keyboard Shortcut Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every existing planner keyboard command discoverable through an accessible modal and tree-context hint.

**Architecture:** Define shortcut groups once in a focused React component, render them in an accessible modal, and keep the tree-scoped `?` trigger in `TreeGrid`. The modal owns focus management and reports no new command behavior; existing tree and DnD tests remain the command source of truth.

**Tech Stack:** React, TypeScript, React Testing Library, Vitest, native CSS.

---

## File structure

- Create: `src/components/KeyboardShortcutsDialog.tsx` and its component test.
- Modify: `src/app/ProjectApp.tsx`, `src/components/TreeGrid.tsx`,
  `src/components/TreeGrid.test.tsx`, and `src/components/planner.css`.

### Task 1: Implement the accessible shortcut dialog

**Files:**
- Create: `src/components/KeyboardShortcutsDialog.tsx`
- Create: `src/components/KeyboardShortcutsDialog.test.tsx`
- Modify: `src/components/planner.css`

- [ ] **Step 1: Write failing dialog tests**

Test the complete modal contract:

```tsx
await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
expect(screen.getByText('Navigate')).toBeVisible();
expect(screen.getByText('Edit structure')).toBeVisible();
expect(screen.getByText('Drag and drop')).toBeVisible();
await user.keyboard('{Escape}');
expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Keyboard shortcuts' })).toHaveFocus();
```

Also assert every displayed binding/outcome pair: Arrow Up/Down, Arrow Right,
Arrow Left, Enter, Tab, Shift+Tab, Escape, and Space.

- [ ] **Step 2: Run the dialog test to verify it fails**

Run:

```bash
npx vitest run src/components/KeyboardShortcutsDialog.test.tsx --coverage=false
```

Expected: FAIL because the dialog module does not exist.

- [ ] **Step 3: Implement one shared shortcut data definition and modal**

Export `SHORTCUT_GROUPS` and `KeyboardShortcutsDialog` from the new module.
Use this exact group shape:

```ts
export interface Shortcut {
  readonly keys: readonly string[];
  readonly description: string;
}

export interface ShortcutGroup {
  readonly title: string;
  readonly shortcuts: readonly Shortcut[];
}
```

Render a native semantic dialog container with `role="dialog"`,
`aria-modal="true"`, and `aria-labelledby` pointing to the `Keyboard
shortcuts` heading. Render each key through a `kbd` element and each outcome
as text. On open, focus the Close button; keep Tab focus within the dialog;
on Escape or Close, invoke `onClose` and restore focus to the opener through
the caller's ref. Add CSS keycaps and a responsive dialog width.

- [ ] **Step 4: Run focused tests and commit**

```bash
npx vitest run src/components/KeyboardShortcutsDialog.test.tsx --coverage=false
git add src/components/KeyboardShortcutsDialog.tsx src/components/KeyboardShortcutsDialog.test.tsx src/components/planner.css
git commit -m "feat: add keyboard shortcut dialog"
```

Expected: dialog test passes.

### Task 2: Wire toolbar and tree-scoped discovery

**Files:**
- Modify: `src/app/ProjectApp.tsx`, `src/components/TreeGrid.tsx`,
  `src/components/TreeGrid.test.tsx`, `src/app/ProjectApp.test.tsx`,
  `src/components/planner.css`

- [ ] **Step 1: Write failing integration tests**

Add these cases:

```tsx
await user.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();

treeitem.focus();
await user.keyboard('?');
expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();

titleInput.focus();
await user.keyboard('?');
expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();

expect(screen.getByText('Need shortcuts? Press ?')).toBeVisible();
```

- [ ] **Step 2: Run the integration tests to verify they fail**

Run:

```bash
npx vitest run src/components/TreeGrid.test.tsx src/app/ProjectApp.test.tsx --coverage=false
```

Expected: FAIL because no toolbar/modal state or `?` callback exists.

- [ ] **Step 3: Wire state and scoped keyboard trigger**

In `ProjectApp`, hold `isShortcutsOpen` and a ref to the toolbar button.
Render the persistent `Keyboard shortcuts` button with
`aria-haspopup="dialog"` and `aria-expanded`; pass an `onShowShortcuts`
callback to `TreeGrid`; render the dialog only when open and restore focus to
the button after closure.

In `TreeGrid`, handle `?` only when the event target is the treeitem itself,
not an input or drag handle. Call `preventDefault()` only when opening the
dialog. Render the exact empty-state hint `Need shortcuts? Press ?` alongside
the existing Add initiative action.

- [ ] **Step 4: Run full verification and commit**

```bash
npm run verify
npm run e2e
git add src/app/ProjectApp.tsx src/app/ProjectApp.test.tsx src/components/TreeGrid.tsx src/components/TreeGrid.test.tsx src/components/planner.css
git commit -m "feat: expose planner keyboard shortcuts"
```

Expected: all unit/build checks and the existing browser workflow pass.

## Spec coverage review

- Persistent modal, grouped complete command list, semantic keycaps: Task 1.
- Toolbar access, tree-only `?`, protected inline editing, empty-state hint:
  Task 2.
- Focus, Escape, focus restoration, and displayed shortcut coverage: Task 1
  tests; existing keyboard tree/DnD tests continue to prove behavior.
