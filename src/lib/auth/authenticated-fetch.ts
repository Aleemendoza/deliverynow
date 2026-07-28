"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

let synchronizedAccessToken: string | null = null;
let pendingSessionSync: Promise<void> | null = null;

export async function synchronizeBrowserSession() {
  const supabase = createSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Iniciá sesión para continuar.");
  if (synchronizedAccessToken !== session.access_token) {
    pendingSessionSync ??= fetch("/api/auth/session", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken: session.access_token, refreshToken: session.refresh_token }) }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message ?? "No pudimos validar tu sesión.");
      }
      synchronizedAccessToken = session.access_token;
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
