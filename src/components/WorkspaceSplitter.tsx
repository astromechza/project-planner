import { useState } from 'react';

interface WorkspaceSplitterProps {
  readonly value: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly onChange: (value: number) => void;
}

interface PointerCaptureTarget {
  readonly setPointerCapture?: (pointerId: number) => void;
  readonly hasPointerCapture?: (pointerId: number) => boolean;
  readonly releasePointerCapture?: (pointerId: number) => void;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const capturePointer = (element: HTMLElement, pointerId: number): void => {
  const pointerTarget = element as unknown as PointerCaptureTarget;
  const setPointerCapture = pointerTarget.setPointerCapture;
  if (setPointerCapture !== undefined) {
    setPointerCapture.call(element, pointerId);
  }
};

const releasePointer = (element: HTMLElement, pointerId: number): void => {
  const pointerTarget = element as unknown as PointerCaptureTarget;
  const hasPointerCapture = pointerTarget.hasPointerCapture;
  const releasePointerCapture = pointerTarget.releasePointerCapture;
  if (
    hasPointerCapture !== undefined &&
    hasPointerCapture.call(element, pointerId) &&
    releasePointerCapture !== undefined
  ) {
    releasePointerCapture.call(element, pointerId);
  }
};

export function WorkspaceSplitter({
  value,
  minimum,
  maximum,
  onChange,
}: WorkspaceSplitterProps): React.JSX.Element {
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ): void => {
    event.preventDefault();
    capturePointer(event.currentTarget, event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ): void => {
    if (!dragging) {
      return;
    }

    const workspaceRight =
      event.currentTarget.parentElement?.getBoundingClientRect().right ?? 0;
    const rightEdge = workspaceRight > 0 ? workspaceRight : window.innerWidth;
    onChange(clamp(rightEdge - event.clientX, minimum, maximum));
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>): void => {
    releasePointer(event.currentTarget, event.pointerId);
    setDragging(false);
  };

  return (
    <div
      className={`planner-splitter${dragging ? ' planner-splitter--dragging' : ''}`}
      data-testid="workspace-splitter"
      role="separator"
      aria-label="Resize task inspector"
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={Math.round(value)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
    />
  );
}
