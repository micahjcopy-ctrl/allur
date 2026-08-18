import { useState } from "react";
import { Loader2, Check, Send } from "lucide-react";

// Deliberately dependency-light: this renders inside the crash ErrorBoundary,
// so it uses plain elements + design tokens rather than shadcn components (a bug
// in one of those must not take down the "report a bug" escape hatch itself).

const apiBase = (): string => {
  try {
    return import.meta.env.BASE_URL.replace(/\/+$/, "");
  } catch {
    return "";
  }
};

type Status = "idle" | "sending" | "sent" | "error";

export function BugReportForm({
  kind,
  errorCode,
  sentryId,
  defaultEmail,
  onSent,
}: {
  kind: "crash" | "feedback";
  errorCode?: string;
  sentryId?: string;
  defaultEmail?: string;
  onSent?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [status, setStatus] = useState<Status>("idle");

  const submit = async () => {
    if (message.trim().length < 3 || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch(`${apiBase()}/api/support/bug-report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          message: message.trim(),
          email: email.trim(),
          errorCode: errorCode ?? "",
          sentryId: sentryId ?? "",
          path: typeof window !== "undefined" ? window.location.pathname : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus("sent");
      onSent?.();
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
        <Check className="h-4 w-4 shrink-0 text-primary" />
        <span>Thanks — your report was sent. We'll take a look.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 text-left">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          kind === "crash"
            ? "What were you doing when it crashed? (optional but helps a lot)"
            : "What's going wrong? The more detail, the faster we can fix it."
        }
        rows={4}
        className="w-full resize-none rounded-xl border border-border bg-secondary/50 px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email (optional, so we can follow up)"
        className="w-full rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
      />
      {status === "error" && (
        <p className="text-xs text-destructive">
          Couldn't send that — check your connection and try again.
        </p>
      )}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={message.trim().length < 3 || status === "sending"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> Send report
          </>
        )}
      </button>
    </div>
  );
}
