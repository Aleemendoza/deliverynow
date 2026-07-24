import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado");
  const cookieStore = await cookies();
  return createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll(), setAll: (entries) => { try { entries.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Route handlers may not mutate cookies. */ } } } });
}
