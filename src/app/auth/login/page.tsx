"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/domain";

const homeForRole: Record<UserRole, string> = { customer: "/account", courier: "/courier", admin: "/admin" };
function destinationForRole(role: UserRole | undefined, requestedPath: string | null) {
  if (!role) return "/";
  if (requestedPath?.startsWith("/") && ((role === "customer" && ["/account", "/solicitar"].some((path) => requestedPath.startsWith(path))) || (role === "courier" && requestedPath.startsWith("/courier")) || (role === "admin" && requestedPath.startsWith("/admin")))) return requestedPath;
  return homeForRole[role];
}

export default function Login() {
  const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const requestedPath = () => new URLSearchParams(window.location.search).get("next");
  const signIn = async (form: FormData) => { setLoading(true); setMessage(""); try { const supabase = createSupabaseBrowserClient(); const { data, error } = await supabase.auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) }); if (error) throw error; const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle<{ role: UserRole }>(); window.location.assign(destinationForRole(profile?.role, requestedPath())); } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión"); } finally { setLoading(false); } };
  const google = async () => { setLoading(true); try { const supabase = createSupabaseBrowserClient(); const next = requestedPath(); const callback = new URL("/auth/callback", window.location.origin); if (next?.startsWith("/")) callback.searchParams.set("next", next); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } }); if (error) throw error; } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo iniciar Google"); } finally { setLoading(false); } };
  return <main className="mx-auto max-w-md px-4 py-20"><h1 className="text-3xl font-bold">Ingresar</h1><p className="mt-2 text-zinc-400">Accedé a tu cuenta o panel operativo.</p><form autoComplete="off" action={signIn} className="mt-7 grid gap-3"><input autoComplete="off" required name="email" type="email" placeholder="Correo" className="rounded-lg bg-zinc-900 px-4 py-3"/><input autoComplete="off" required name="password" type="password" placeholder="Contraseña" className="rounded-lg bg-zinc-900 px-4 py-3"/><button disabled={loading} className="rounded-lg bg-yellow-400 py-3 font-bold text-black disabled:opacity-50">Continuar</button></form><button disabled={loading} onClick={google} className="mt-3 w-full rounded-lg border border-white/20 py-3 disabled:opacity-50">Continuar con Google</button>{message && <p role="alert" className="mt-4 text-sm text-red-400">{message}</p>}<Link href="/auth/register" className="mt-5 block text-sm text-yellow-400">Crear cuenta</Link><Link href="/auth/forgot-password" className="mt-3 block text-sm text-zinc-400">Olvidé mi contraseña</Link></main>;
}
