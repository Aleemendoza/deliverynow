import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";

const homeForRole: Record<UserRole, string> = { customer: "/account", courier: "/courier", admin: "/admin" };
function destinationForRole(role: UserRole | undefined, requestedPath: string) {
  if (!role) return "/";
  if ((role === "customer" && ["/account", "/solicitar"].some((path) => requestedPath.startsWith(path))) || (role === "courier" && requestedPath.startsWith("/courier")) || (role === "admin" && requestedPath.startsWith("/admin"))) return requestedPath;
  return homeForRole[role];
}

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/";
  if (code) { const supabase = await createSupabaseServerClient(); const { error } = await supabase.auth.exchangeCodeForSession(code); if (!error) { const { data: { user } } = await supabase.auth.getUser(); const { data: profile } = user ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: UserRole }>() : { data: null }; return NextResponse.redirect(new URL(destinationForRole(profile?.role, next), url.origin)); } }
  return NextResponse.redirect(new URL("/auth/login?error=oauth", url.origin));
}
