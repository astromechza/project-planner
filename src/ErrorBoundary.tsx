import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RECOVERY_STORAGE_KEY } from './infrastructure/recoveryStore';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Project planner failed to render.', error, errorInfo);
  }

  private startBlankPlan(): void {
    try {
      window.localStorage.removeItem(RECOVERY_STORAGE_KEY);
    } catch {
      // Storage may be unavailable; reloading still returns to a usable planner.
    }
    window.location.reload();
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="planner-error" aria-label="Project planner error">
          <h1>Planner unavailable</h1>
          <p>Recovery data may still be available in this browser.</p>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload planner
          </button>
          <button
            type="button"
            onClick={() => {
              this.startBlankPlan();
            }}
          >
            Start a blank plan
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
