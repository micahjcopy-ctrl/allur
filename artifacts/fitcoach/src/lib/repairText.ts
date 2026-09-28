// Repairs "mojibake": text whose UTF-8 bytes were once read as Latin-1 and
// saved again, so "—" became "â\u0080\u0094" and "→" became "â\u0086\u0092".
//
// Why this exists: from 2026-07-29 until build 7, `data/trainingKnowledge.ts`
// (and predict/prs) shipped with exactly that corruption, so every plan built
// in that window stored day titles like "Full Body â\u0080\u0094 Squat Focus"
// in the user's saved state. Fixing the source only helps plans built after
// the fix; saved states are repaired here on hydration, and the debounced
// writer then persists the clean text, so the repair is one-shot per account.
//
// Safety: a match is a UTF-8 lead byte (0xC2–0xF4) followed by 1–3
// continuation bytes (0x80–0xBF), all read as Latin-1 characters. Real ALLUR
// text never contains a run like that — the continuation range is C1 control
// characters and symbols such as "¡¢£" — and the decoder runs in fatal mode,
// so anything that is not valid UTF-8 is left exactly as it was.

const SUSPECT = /[Â-ô][\u0080-¿]{1,3}/g;

let decoder: TextDecoder | null = null;

export function repairMojibake(text: string): string {
  if (typeof text !== "string" || text.length < 2) return text;
  // Cheap pre-check: nothing in the lead-byte range means nothing to do.
  let suspect = false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xc2 && c <= 0xf4) {
      suspect = true;
      break;
    }
  }
  if (!suspect) return text;
  decoder ??= new TextDecoder("utf-8", { fatal: true });
  return text.replace(SUSPECT, (run) => {
    // Try the longest valid prefix first (a 3-byte "—" followed by a legit
    // "¡" must not swallow the "¡").
    for (let len = run.length; len >= 2; len--) {
      const bytes = Uint8Array.from(run.slice(0, len), (ch) => ch.charCodeAt(0));
      try {
        return decoder!.decode(bytes) + run.slice(len);
      } catch {
        // not valid UTF-8 at this length — try shorter
      }
    }
    return run;
  });
}

/**
 * Walks any JSON-shaped value and repairs every string in it. Objects and
 * arrays are only copied when something inside actually changed, so an
 * already-clean state comes back as the same reference.
 */
export function repairMojibakeDeep<T>(value: T): T {
  if (typeof value === "string") return repairMojibake(value) as unknown as T;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = repairMojibakeDeep(item);
      if (next !== item) changed = true;
      return next;
    });
    return (changed ? out : value) as unknown as T;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const next = repairMojibakeDeep(v);
      if (next !== v) changed = true;
      out[k] = next;
    }
    return (changed ? out : value) as unknown as T;
  }
  return value;
}
