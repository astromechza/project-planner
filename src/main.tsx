import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './ErrorBoundary';
import { ProjectApp } from './app/ProjectApp';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Project planner root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <ProjectApp />
    </ErrorBoundary>
  </StrictMode>,
);
