import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/";
  if (code) { const supabase = await createSupabaseServerClient(); const { error } = await supabase.auth.exchangeCodeForSession(code); if (!error) { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: "customer" | "courier" | "admin" }>() : { data: null }; const destination = next !== "/" ? next : profile?.role === "courier" ? "/courier" : profile?.role === "admin" ? "/admin" : "/"; return NextResponse.redirect(new URL(destination, url.origin)); } }
  return NextResponse.redirect(new URL("/auth/login?error=oauth", url.origin));
}
