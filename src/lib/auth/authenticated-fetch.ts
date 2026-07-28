"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

let synchronizedAccessToken: string | null = null;
let synchronizedUntil = 0;
let pendingSessionSync: Promise<void> | null = null;

const SESSION_VALIDATION_WINDOW_MS = 60 * 60 * 1000;

export async function synchronizeBrowserSession() {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Iniciá sesión para continuar.");
  if (synchronizedAccessToken !== session.access_token || Date.now() >= synchronizedUntil) {
    pendingSessionSync ??= fetch("/api/auth/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ accessToken: session.access_token }) }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message ?? "No pudimos validar tu sesión.");
      }
      const payload = await response.json().catch(() => null) as { validUntil?: number } | null;
      synchronizedAccessToken = session.access_token;
      synchronizedUntil = typeof payload?.validUntil === "number" ? payload.validUntil : Date.now() + SESSION_VALIDATION_WINDOW_MS;
    }).finally(() => { pendingSessionSync = null; });
    await pendingSessionSync;
  }
  return session.access_token;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const accessToken = await synchronizeBrowserSession();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}
