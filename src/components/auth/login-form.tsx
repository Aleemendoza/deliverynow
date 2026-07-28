"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AuthCard, AuthFeedback, AuthPage, AuthSubmitButton, authInputClass, PasswordField } from "@/components/auth/auth-ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/domain";

const homeForRole: Record<UserRole, string> = { customer: "/account", courier: "/courier", admin: "/admin" };

function destinationForRole(role: UserRole | undefined, requestedPath: string | null) {
  if (!role) return "/";
  const allowed = (role === "customer" && ["/account", "/solicitar"].some((path) => requestedPath?.startsWith(path))) || (role === "courier" && requestedPath?.startsWith("/courier")) || (role === "admin" && requestedPath?.startsWith("/admin"));
  return allowed ? requestedPath! : homeForRole[role];
}

function loginErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "El correo o la contraseña no son correctos. Revisalos e intentá nuevamente.";
  if (message.includes("email not confirmed")) return "Tu correo todavía no fue confirmado. Revisá tu bandeja de entrada o solicitá un nuevo enlace.";
  if (message.includes("rate limit") || message.includes("too many")) return "Hiciste varios intentos seguidos. Esperá unos minutos antes de volver a probar.";
  if (message.includes("fetch") || message.includes("network")) return "No pudimos conectarnos. Verificá tu conexión e intentá nuevamente.";
  return "No pudimos iniciar sesión en este momento. Intentá nuevamente en unos minutos.";
}

export function LoginForm() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [feedback, setFeedback] = useState<{ tone: "error"; message: string } | null>(null); const [pending, setPending] = useState(false);
  const requestedPath = () => new URLSearchParams(window.location.search).get("next");
  const clearFeedback = () => feedback && setFeedback(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setFeedback(null);
    try { const supabase = createSupabaseBrowserClient(); const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (error) throw error; const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle<{ role: UserRole }>(); window.location.assign(destinationForRole(profile?.role, requestedPath())); } catch (error) { setFeedback({ tone: "error", message: loginErrorMessage(error) }); } finally { setPending(false); }
  }

  async function google() {
    setPending(true); setFeedback(null);
    try { const supabase = createSupabaseBrowserClient(); const next = requestedPath(); const callback = new URL("/auth/callback", window.location.origin); if (next?.startsWith("/")) callback.searchParams.set("next", next); const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } }); if (error) throw error; } catch (error) { setFeedback({ tone: "error", message: loginErrorMessage(error) }); } finally { setPending(false); }
  }

  return <AuthPage><AuthCard eyebrow="Tu cuenta" title="Bienvenido de nuevo" description="Ingresá para gestionar tus envíos y acceder a tu panel operativo."><form data-allow-autocomplete="true" noValidate onSubmit={signIn} className="mt-8 grid gap-5"><div className="grid gap-2"><label htmlFor="login-email" className="text-sm font-medium text-zinc-200">Correo electrónico</label><div className="relative"><Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-500"/><input data-allow-autocomplete="true" id="login-email" required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFeedback(); }} placeholder="nombre@correo.com" className={authInputClass()}/></div></div><PasswordField id="login-password" value={password} onChange={(value) => { setPassword(value); clearFeedback(); }} autoComplete="current-password"/><div className="-mt-2 flex justify-end"><Link href="/auth/forgot-password" className="text-sm font-medium text-brand transition hover:text-sky-200">¿Olvidaste tu contraseña?</Link></div><AuthFeedback feedback={feedback}/><AuthSubmitButton pending={pending}>Ingresar</AuthSubmitButton></form><div className="my-6 flex items-center gap-3 text-xs text-zinc-500"><span className="h-px flex-1 bg-white/10"/>o continuá con<span className="h-px flex-1 bg-white/10"/></div><button type="button" disabled={pending} onClick={google} className="min-h-12 w-full rounded-xl border border-white/15 px-4 py-3 font-semibold text-zinc-100 transition hover:border-white/30 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-65">Continuar con Google</button><p className="mt-7 text-center text-sm text-zinc-400">¿Todavía no tenés cuenta? <Link href="/auth/register" className="font-semibold text-brand hover:text-sky-200">Crearla ahora</Link></p></AuthCard></AuthPage>;
}
