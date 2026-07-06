import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Project, TaskId } from '../domain/types';
import { DependencyEditor } from './DependencyEditor';

afterEach(cleanup);

const id = (value: string): TaskId => value as TaskId;

const createProject = (dependencies: Project['dependencies'] = []): Project => {
  const initiative = id('initiative');
  const epic = id('epic');
  const story = id('story');

  return {
    format: 'project-planner/v1',
    name: 'Health Hub plan',
    rootTaskIds: [initiative, epic, story],
    tasks: {
      [initiative]: {
        id: initiative,
        title: 'Initiative',
        parentId: null,
        childIds: [],
      },
      [epic]: {
        id: epic,
        title: 'Epic',
        parentId: null,
        childIds: [],
      },
      [story]: {
        id: story,
        title: 'Story',
        parentId: null,
        childIds: [],
      },
    },
    dependencies,
  };
};

describe('DependencyEditor', () => {
  it('links the selected task as the blocker from the Blocks control', async () => {
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

    await user.selectOptions(screen.getByLabelText('Blocks'), id('epic'));
    await user.click(screen.getByRole('button', { name: 'Add blocked task' }));

    expect(onLink).toHaveBeenCalledWith(id('initiative'), id('epic'));
  });

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

    await user.selectOptions(screen.getByLabelText('Blocked by'), id('epic'));
    await user.click(screen.getByRole('button', { name: 'Add blocker' }));

    expect(onLink).toHaveBeenCalledWith(id('epic'), id('initiative'));
  });

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

    await user.selectOptions(screen.getByLabelText('Blocks'), id('epic'));
    rerender(
      <DependencyEditor
        project={project}
        selectedTaskId={id('story')}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Blocks')).toHaveValue('');
  });

  it('excludes the selected task and existing blocker links from both controls', () => {
    const project = createProject([
      { blockerId: id('initiative'), blockedId: id('epic') },
      { blockerId: id('story'), blockedId: id('initiative') },
    ]);

    render(
      <DependencyEditor
        project={project}
        selectedTaskId={id('initiative')}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Blocks')).toHaveTextContent('Story');
    expect(screen.getByLabelText('Blocks')).not.toHaveTextContent('Initiative');
    expect(screen.getByLabelText('Blocks')).not.toHaveTextContent('Epic');
    expect(screen.getByLabelText('Blocked by')).toHaveTextContent('Epic');
    expect(screen.getByLabelText('Blocked by')).not.toHaveTextContent(
      'Initiative',
    );
    expect(screen.getByLabelText('Blocked by')).not.toHaveTextContent('Story');
  });

  it('marks dependency selectors for constrained layout sizing', () => {
    render(
      <DependencyEditor
        project={createProject()}
        selectedTaskId={id('initiative')}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Blocks')).toHaveClass(
      'dependency-control-select',
    );
    expect(screen.getByLabelText('Blocked by')).toHaveClass(
      'dependency-control-select',
    );
  });

  it('provides accessible controls to remove existing blocker links', async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();
    const project = createProject([
      { blockerId: id('initiative'), blockedId: id('epic') },
      { blockerId: id('story'), blockedId: id('initiative') },
    ]);

    render(
      <DependencyEditor
        project={project}
        selectedTaskId={id('initiative')}
        onLink={vi.fn()}
        onUnlink={onUnlink}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Remove blocking relationship with Epic',
      }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Remove blocker relationship with Story',
      }),
    );

    expect(onUnlink).toHaveBeenNthCalledWith(1, id('initiative'), id('epic'));
    expect(onUnlink).toHaveBeenNthCalledWith(2, id('story'), id('initiative'));
  });

  it('warns when the selected task is part of a dependency cycle', () => {
    const project = createProject([
      { blockerId: id('initiative'), blockedId: id('epic') },
      { blockerId: id('epic'), blockedId: id('initiative') },
    ]);

    render(
      <DependencyEditor
        project={project}
        selectedTaskId={id('initiative')}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Dependency cycle detected.',
    );
  });
});
