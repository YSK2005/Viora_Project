import React from "react";
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Application render failed", error);
  }
  render() {
    return this.state.failed ? (
      <main className="p-8 max-w-xl mx-auto" role="alert">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="my-4">
          Your saved records are safe. Reload to try again.
        </p>
        <button
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload application
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
