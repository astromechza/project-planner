# Local Project Planner

A browser-first, local project planner for building a five-level hierarchy:
Initiative, Epic, Story, Task, and Subtask. Task type is inferred from depth.

## Requirements and setup

Use Node.js 24.x and npm.

```sh
npm ci
```

## Run and verify

```sh
npm run dev
npm run verify
npm run e2e
```

`npm run verify` checks formatting, linting, TypeScript, unit tests with
coverage, and the production build. `npm run e2e` starts the Vite server and
runs the browser workflow.

## Keyboard controls

Select a task in the tree, then use:

- Arrow Up / Arrow Down to move selection.
- Arrow Right to expand a parent or move to its first child.
- Arrow Left to collapse a parent or select its parent.
- Enter to add a following sibling.
- Tab to indent beneath the preceding sibling; Shift+Tab to outdent.

Double-click a task title to edit it. The depth limit is five, so a Subtask
cannot receive a child.

## Local files and recovery

The app automatically keeps a recovery copy in browser local storage after a
change. It is a convenience cache, not a backup: clearing browser data,
changing browser profiles, private browsing, or storage failures can remove it.

Use **Export** to download the portable `project-planner/v1` JSON file, and
**Import** to open a validated file. Export and import keep hierarchy, order,
notes, and blocker links. There is no Jira connection or synchronisation yet;
Jira export is a future feature.
