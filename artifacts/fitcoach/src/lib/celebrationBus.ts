import type { CelebrationKind } from "./celebration";

// ---------------------------------------------------------------------------
// A tiny synchronous pub/sub so any part of the app (context actions, effects)
// can fire a celebration without depending on React context ordering. The
// CelebrationHost subscribes once and renders the confetti/banner/chime.
// ---------------------------------------------------------------------------

export interface CelebrationEvent {
  kind: CelebrationKind;
  /** Optional overrides for the default title/subtitle from the config. */
  title?: string;
  message?: string;
}

type Listener = (event: CelebrationEvent) => void;

const listeners = new Set<Listener>();

export function subscribeCelebration(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitCelebration(
  kind: CelebrationKind,
  opts: { title?: string; message?: string } = {},
): void {
  const event: CelebrationEvent = {
    kind,
    title: opts.title,
    message: opts.message,
  };
  // A celebration must never break the action that triggered it.
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      /* swallow */
    }
  });
}
