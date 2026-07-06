# Sibling Reordering Keyboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ( - [ ] ) syntax for tracking.

**Goal:** Add Shift+Arrow Up/Down shortcuts that move a focused task within its current sibling list without changing its parent.

**Architecture:** Extend TreeGrid’s existing keyboard handler to resolve the task’s sibling container and call the existing onMove callback with a same-parent destination index. moveTask remains responsible for applying and validating the reorder. Add the two shortcuts to the existing keyboard-shortcuts data structure and cover behavior with focused component tests.

**Tech Stack:** React 19, TypeScript with strict compiler settings, Vitest, Testing Library, ESLint, Prettier, Vite.

---

### Task 1: Add failing tests for sibling reordering

**Files:**
- Modify: src/components/TreeGrid.test.tsx

- [ ] Step 1: Add a root-sibling movement test

Add a test that renders TreeHarness, focuses Initiative, sends Shift+ArrowDown, and asserts the tree-item order becomes Story, Initiative. Then send Shift+ArrowUp to the moved initiative and assert the original order is restored. Assert the moved row remains focused after each reorder.

    it('moves a root task down and back up within its siblings', () => {
      render(<TreeHarness />);

      const initiative = screen.getByRole('treeitem', { name: 'Initiative' });
      fireEvent.click(initiative);
      fireEvent.keyDown(initiative, { key: 'ArrowDown', shiftKey: true });

      expect(screen.getAllByRole('treeitem').map((item) => item.ariaLabel)).toEqual([
        'Story',
        'Initiative',
      ]);
      const movedInitiative = screen.getByRole('treeitem', {
        name: 'Initiative',
      });
      expect(movedInitiative).toHaveFocus();

      fireEvent.keyDown(movedInitiative, {
        key: 'ArrowUp',
        shiftKey: true,
      });

      expect(screen.getAllByRole('treeitem').map((item) => item.ariaLabel)).toEqual([
        'Initiative',
        'Story',
      ]);
      expect(screen.getByRole('treeitem', { name: 'Initiative' })).toHaveFocus();
    });

- [ ] Step 2: Add nested and boundary tests

Add a test that expands Initiative, renders two child siblings, moves the second child up, and asserts only Initiative’s child order changes. Add boundary assertions that Shift+ArrowUp on the first root task and Shift+ArrowDown on the last root task leave the order unchanged. Also assert an unmodified ArrowDown still selects the next visible row.

- [ ] Step 3: Run the focused tests and verify they fail

Run:

    npm test -- src/components/TreeGrid.test.tsx

Expected: the new movement assertions fail because TreeGrid currently treats the modified arrow keys as navigation and does not reorder sibling arrays.

### Task 2: Implement keyboard sibling movement

**Files:**
- Modify: src/components/TreeGrid.tsx around the existing indent, outdent, and handleKeyDown helpers

- [ ] Step 1: Add a focused sibling-move helper

Place the helper beside indent and outdent:

    const moveSibling = (task: PlanTask, direction: 'up' | 'down'): boolean => {
      const siblings = getSiblings(project, task);
      const currentIndex = siblings.indexOf(task.id);
      if (currentIndex === -1) {
        return false;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= siblings.length) {
        return false;
      }

      onMove(task.id, {
        parentId: task.parentId,
        index: targetIndex > currentIndex ? targetIndex + 1 : targetIndex,
      });
      return true;
    };

The extra index adjustment is required because moveTask validates destinations against the source list before removing the task and subtracts one when moving forward within the same container.

- [ ] Step 2: Intercept modified arrow keys before ordinary navigation

At the start of handleKeyDown, before the ordinary switch, handle only Shift+ArrowUp and Shift+ArrowDown:

    if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const moved = moveSibling(task, event.key === 'ArrowUp' ? 'up' : 'down');
      if (moved) {
        event.preventDefault();
      }
      return;
    }

This prevents modified arrows from falling through to selection navigation. A boundary no-op does not call onMove or prevent the event. Plain ArrowUp and ArrowDown continue through the existing navigation cases.

- [ ] Step 3: Run the focused tests and verify they pass

Run:

    npm test -- src/components/TreeGrid.test.tsx

Expected: all TreeGrid tests pass, including root movement, nested movement, boundaries, focus preservation, and ordinary arrow navigation.

### Task 3: Document the new shortcuts

**Files:**
- Modify: src/components/KeyboardShortcutsDialog.tsx in the Edit structure shortcuts
- Modify: src/components/KeyboardShortcutsDialog.test.tsx

- [ ] Step 1: Add shortcut metadata

Add these entries to the Edit structure shortcuts list:

    {
      keys: ['Shift', 'Arrow Up'],
      description: 'Move a task up within its siblings',
    },
    {
      keys: ['Shift', 'Arrow Down'],
      description: 'Move a task down within its siblings',
    },

- [ ] Step 2: Extend dialog metadata coverage

Assert SHORTCUT_GROUPS[1]?.shortcuts contains both entries. The existing semantic rendering test will also verify that both descriptions and keycaps appear in the dialog.

- [ ] Step 3: Run focused dialog tests

Run:

    npm test -- src/components/KeyboardShortcutsDialog.test.tsx

Expected: all dialog tests pass.

### Task 4: Run full verification and commit

**Files:**
- No additional files.

- [ ] Step 1: Run the complete quality gate

Run:

    npm run verify

Expected: Prettier, ESLint, TypeScript, all Vitest tests with coverage, and the Vite production build pass.

- [ ] Step 2: Inspect the final diff and status

Run:

    git diff --check
    git status --short
    git diff --stat

Expected: no whitespace errors; only the planned TreeGrid, shortcut dialog, and test changes are present.

- [ ] Step 3: Commit the implementation

    git add src/components/TreeGrid.tsx src/components/TreeGrid.test.tsx src/components/KeyboardShortcutsDialog.tsx src/components/KeyboardShortcutsDialog.test.tsx
    git commit -m "feat: add sibling movement shortcuts"

