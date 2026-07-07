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

  it('keeps Add blocker disabled for empty input when a candidate has an empty title', () => {
    const empty = id('empty');
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Empty title check',
      rootTaskIds: [id('initiative'), empty],
      tasks: {
        [id('initiative')]: {
          id: id('initiative'),
          title: 'Initiative',
          parentId: null,
          childIds: [],
        },
        [empty]: { id: empty, title: '', parentId: null, childIds: [] },
      },
      dependencies: [],
    };

    render(
      <DependencyEditor
        project={project}
        selectedTaskId={id('initiative')}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Blocked by')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Add blocker' })).toBeDisabled();
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

    await user.type(screen.getByLabelText('Blocked by'), 'Epic');
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

  it('excludes the selected task and existing blocker links from the control', () => {
    const project = createProject([
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

    const optionValues = Array.from(
      document.querySelectorAll('datalist option'),
    ).map((option) => option.getAttribute('value'));

    expect(optionValues).toEqual(['Epic']);
  });

  it('sorts the Blocked by options alphanumerically, not by task order', () => {
    const zebra = id('zebra');
    const apple = id('apple');
    const project: Project = {
      format: 'project-planner/v1',
      name: 'Sort check',
      rootTaskIds: [id('initiative'), zebra, apple],
      tasks: {
        [id('initiative')]: {
          id: id('initiative'),
          title: 'Initiative',
          parentId: null,
          childIds: [],
        },
        [zebra]: { id: zebra, title: 'Zebra', parentId: null, childIds: [] },
        [apple]: { id: apple, title: 'Apple', parentId: null, childIds: [] },
      },
      dependencies: [],
    };

    render(
      <DependencyEditor
        project={project}
        selectedTaskId={id('initiative')}
        onLink={vi.fn()}
        onUnlink={vi.fn()}
      />,
    );

    const optionValues = Array.from(
      document.querySelectorAll('datalist option'),
    ).map((option) => option.getAttribute('value'));

    expect(optionValues).toEqual(['Apple', 'Zebra']);
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
        name: 'Remove blocker relationship with Story',
      }),
    );

    expect(onUnlink).toHaveBeenCalledTimes(1);
    expect(onUnlink).toHaveBeenCalledWith(id('story'), id('initiative'));
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
