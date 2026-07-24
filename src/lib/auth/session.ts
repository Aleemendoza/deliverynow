import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id,full_name,role").eq("id", user.id).maybeSingle<{ id: string; full_name: string | null; role: UserRole }>();
  return profile ? { user, profile, supabase } : null;
}

export async function requireRole(role: UserRole) {
  const current = await getCurrentUser();
  if (!current) redirect(`/auth/login?next=/${role === "courier" ? "courier" : "admin"}`);
  if (current.profile.role !== role) redirect("/");
  return current;
}
