// Offer to save the just-used login to the browser / OS password manager via the
// Credential Management API. This is what triggers the native "Save password?"
// prompt in Chromium browsers (Chrome, Edge, Android, installed PWAs). Browsers
// without `PasswordCredential` (Safari, Firefox) fall back to their own built-in
// form-based save heuristics, which the auth form already supports through its
// `autocomplete` attributes — so this is purely additive and best-effort.
interface PasswordCredentialInit {
  id: string;
  password: string;
  name?: string;
}

interface PasswordCredentialCtor {
  new (data: PasswordCredentialInit): Credential;
}

export async function offerToSaveCredential(
  id: string,
  password: string,
  name?: string,
): Promise<void> {
  try {
    if (typeof window === "undefined") return;
    const Ctor = (window as unknown as { PasswordCredential?: PasswordCredentialCtor })
      .PasswordCredential;
    if (!Ctor || !navigator.credentials?.store) return;
    if (!id || !password) return;
    const cred = new Ctor({ id, password, name: name || id });
    await navigator.credentials.store(cred);
  } catch {
    // Best-effort only — never block the auth flow on a credential-store failure.
  }
}
