import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function isAnonJwt(key: string) {
  const payload = key.split(".")[1];
  if (!payload) return false;

  try {
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, "=");
    const claims = JSON.parse(Buffer.from(paddedPayload, "base64").toString("utf8")) as { role?: string };
    return claims.role === "anon";
  } catch {
    return false;
  }
}

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key?.startsWith("sb_publishable_")) throw new Error("SUPABASE_SERVICE_ROLE_KEY uses a publishable key. Configure a Supabase secret key (sb_secret) or legacy service_role key on the server only.");
  if (!url || !key) throw new Error("Supabase no está configurado");
  if (isAnonJwt(key)) throw new Error("SUPABASE_SERVICE_ROLE_KEY uses an anon key. Configure the Supabase service_role key on the server only.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createSupabaseServerClient(request?: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado");
  const cookieStore = await cookies();
  const authorization = request?.headers.get("authorization");
  return createServerClient(url, key, {
    ...(authorization ? { global: { headers: { Authorization: authorization } } } : {}),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (entries) => {
        try {
          entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot persist refreshed cookies; Proxy handles them.
        }
      },
    },
  });
}
