import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { RefreshCw } from "lucide-react";
import { BugReportForm } from "@/components/BugReportForm";

// ---------------------------------------------------------------------------
// App-wide error boundary. A render error in any screen would otherwise
// white-screen the whole PWA with no way out; this catches it, shows a calm
// branded fallback, reports the crash to Sentry (a no-op when Sentry isn't
// configured), and gives the user a short error code + a form to tell us what
// happened (which emails the support inbox). Class component because React
// error boundaries must be class-based.
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorRef: string;
  sentryId: string;
}

/** Short, human-readable reference shown to the user and attached to the
 *  report, so a screenshot of the crash screen is enough to find it. */
function makeErrorRef(): string {
  const t = Date.now().toString(36).slice(-4).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ALR-${t}${r}`;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorRef: "", sentryId: "" };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const errorRef = makeErrorRef();
    let sentryId = "";
    try {
      sentryId = Sentry.captureException(error, {
        // Tag the Sentry event with the same code the user sees, so a user's
        // report can be matched to the exact event in the dashboard.
        tags: { errorRef },
        extra: { componentStack: info.componentStack },
      });
    } catch {
      /* never let error reporting throw */
    }
    this.setState({ errorRef, sentryId });
    // Keep a console trail for local/dev debugging too.
    // eslint-disable-next-line no-console
    console.error(`App crashed [${errorRef}]:`, error);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { errorRef, sentryId } = this.state;

    return (
      <div className="dark allur-app min-h-[100dvh] w-full flex flex-col items-center justify-center gap-5 px-6 py-10 text-center bg-background text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
          <RefreshCw className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The app hit an unexpected error. Reloading usually clears it — your
            data is safe.
          </p>
          {errorRef && (
            <p className="pt-1 text-xs text-muted-foreground">
              Error code:{" "}
              <span className="font-mono font-semibold text-foreground/90">{errorRef}</span>
            </p>
          )}
        </div>

        <button
          onClick={this.handleReload}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95 transition-transform"
        >
          <RefreshCw className="h-4 w-4" /> Reload
        </button>

        <div className="w-full max-w-sm pt-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Or tell us what happened
          </p>
          <BugReportForm kind="crash" errorCode={errorRef} sentryId={sentryId} />
        </div>
      </div>
    );
  }
}
