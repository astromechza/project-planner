import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanTask, TaskId } from '../domain/types';
import { TreeRow } from './TreeRow';

afterEach(cleanup);

const id = (value: string): TaskId => value as TaskId;

const task: PlanTask = {
  id: id('initiative'),
  title: 'Initiative',
  parentId: null,
  childIds: [],
};

const renderTreeRow = (blocksCount: number, blockedByCount: number): void => {
  render(
    <TreeRow
      task={task}
      depth={1}
      selected={false}
      blocksSelected={false}
      blockedBySelected={false}
      blocksCount={blocksCount}
      blockedByCount={blockedByCount}
      storyPointsTotal={0}
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
};

describe('TreeRow dependency indicator', () => {
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
        storyPointsTotal={0}
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
        storyPointsTotal={0}
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
        storyPointsTotal={0}
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

    expect(
      screen.queryByRole('img', { name: 'Has notes' }),
    ).not.toBeInTheDocument();
  });

  it('shows compact, accessible dependency counts for a linked task', () => {
    renderTreeRow(2, 1);

    expect(
      screen.getByRole('img', {
        name: 'Blocks 2 tasks and is blocked by 1 task',
      }),
    ).toHaveTextContent('↗2 ↙1');
  });

  it('omits the dependency indicator for an unlinked task', () => {
    renderTreeRow(0, 0);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('uses a generated description ID for reciprocal tasks with whitespace IDs', () => {
    const whitespaceTask: PlanTask = {
      ...task,
      id: id('initiative with whitespace'),
      title: 'Whitespace initiative',
    };
    render(
      <TreeRow
        task={whitespaceTask}
        depth={1}
        selected={false}
        blocksSelected
        blockedBySelected
        blocksCount={1}
        blockedByCount={1}
        storyPointsTotal={0}
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

    const treeItem = screen.getByRole('treeitem', {
      name: 'Whitespace initiative',
    });
    const descriptionId = treeItem.getAttribute('aria-describedby');

    expect(descriptionId).not.toContain(whitespaceTask.id);
    expect(descriptionId).not.toBeNull();
    expect(document.getElementById(descriptionId ?? '')).toHaveTextContent(
      'This task both blocks and is blocked by the selected task.',
    );
  });
});
