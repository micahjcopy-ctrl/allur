import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// App-wide error boundary. A render error in any screen would otherwise
// white-screen the whole PWA with no way out; this catches it, shows a calm
// branded fallback with a Reload action, and reports the crash to Sentry (a
// no-op when Sentry isn't configured). Class component because React error
// boundaries must be class-based.
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      Sentry.captureException(error, {
        extra: { componentStack: info.componentStack },
      });
    } catch {
      /* never let error reporting throw */
    }
    // Keep a console trail for local/dev debugging too.
    // eslint-disable-next-line no-console
    console.error("App crashed:", error);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="dark allur-app min-h-[100dvh] w-full flex flex-col items-center justify-center gap-5 px-6 text-center bg-background text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
          <RefreshCw className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The app hit an unexpected error. Reloading usually clears it — your
            data is safe.
          </p>
        </div>
        <button
          onClick={this.handleReload}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition-transform"
        >
          <RefreshCw className="h-4 w-4" /> Reload
        </button>
      </div>
    );
  }
}
