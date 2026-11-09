import { Component, type ReactNode } from 'react';

/** If WebGL is unavailable, the page still reads fine without the scene. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="grid h-full place-items-center px-6 text-center text-sm text-muted">
        The 3D view isn’t available in this browser. Everything it shows is also described on this page.
      </div>
    ) : (
      this.props.children
    );
  }
}

export function SceneFallback() {
  return (
    <div className="grid h-full place-items-center">
      <span className="size-6 animate-spin rounded-full border-2 border-line-strong border-t-ink" aria-label="Loading 3D view" />
    </div>
  );
}
