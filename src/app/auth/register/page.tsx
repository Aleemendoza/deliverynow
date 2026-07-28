"use client";

import Link from "next/link";
import { Mail, UserRound } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { AuthCard, AuthFeedback, AuthPage, AuthSubmitButton, authInputClass, PasswordField } from "@/components/auth/auth-ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function registrationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("already registered") || message.includes("already been registered")) return "Ya existe una cuenta con este correo. Probá ingresando o restablecé tu contraseña.";
  if (message.includes("rate limit") || message.includes("too many")) return "Hiciste varios intentos seguidos. Esperá unos minutos antes de volver a probar.";
  if (message.includes("fetch") || message.includes("network")) return "No pudimos conectarnos. Verificá tu conexión e intentá nuevamente.";
  return "No pudimos crear tu cuenta en este momento. Intentá nuevamente en unos minutos.";
}

export default function Register() {
  const [fullName, setFullName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null); const [pending, setPending] = useState(false);
  const passwordHint = useMemo(() => password.length === 0 || password.length >= 8 ? undefined : "Usá al menos 8 caracteres." , [password]);
  const clearFeedback = () => feedback && setFeedback(null);

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = fullName.trim().replace(/\s+/g, " ");
    if (normalizedName.length < 4) { setFeedback({ tone: "error", message: "Ingresá tu nombre y apellido para crear la cuenta." }); return; }
    if (password.length < 8) { setFeedback({ tone: "error", message: "Elegí una contraseña de al menos 8 caracteres." }); return; }
    setPending(true); setFeedback(null);
    try {
      const { data, error } = await createSupabaseBrowserClient().auth.signUp({ email: email.trim(), password, options: { data: { full_name: normalizedName }, emailRedirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
      setFeedback({ tone: "success", message: data.user?.identities?.length === 0 ? "Ya existe una cuenta con este correo. Probá ingresando o restablecé tu contraseña." : "Te enviamos un correo para verificar tu cuenta. Abrilo para completar el registro." });
      if (data.user?.identities?.length !== 0) setPassword("");
    } catch (error) { setFeedback({ tone: "error", message: registrationErrorMessage(error) }); } finally { setPending(false); }
  }

  return <AuthPage><AuthCard eyebrow="Primer paso" title="Creá tu cuenta" description="Vas a poder pedir envíos, seguirlos en tiempo real y administrar tus datos.">
    <form data-allow-autocomplete="true" noValidate onSubmit={signUp} className="mt-8 grid gap-5">
      <div className="grid gap-2"><label htmlFor="register-name" className="text-sm font-medium text-zinc-200">Nombre y apellido</label><div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-500"/><input data-allow-autocomplete="true" id="register-name" required minLength={4} maxLength={80} autoComplete="name" value={fullName} onChange={(event) => { setFullName(event.target.value); clearFeedback(); }} placeholder="Cómo te llamás" className={authInputClass()}/></div></div>
      <div className="grid gap-2"><label htmlFor="register-email" className="text-sm font-medium text-zinc-200">Correo electrónico</label><div className="relative"><Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-500"/><input data-allow-autocomplete="true" id="register-email" required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFeedback(); }} placeholder="nombre@correo.com" className={authInputClass()}/></div></div>
      <PasswordField id="register-password" value={password} onChange={(value) => { setPassword(value); clearFeedback(); }} autoComplete="new-password" error={passwordHint}/>
      <p className="-mt-3 text-xs leading-5 text-zinc-500">Al crear tu cuenta aceptás nuestros <Link href="/terminos" className="underline hover:text-zinc-300">términos de uso</Link> y la <Link href="/privacidad" className="underline hover:text-zinc-300">política de privacidad</Link>.</p>
      <AuthFeedback feedback={feedback}/><AuthSubmitButton pending={pending}>Crear cuenta</AuthSubmitButton>
    </form>
    <p className="mt-7 text-center text-sm text-zinc-400">¿Ya tenés una cuenta? <Link href="/auth/login" className="font-semibold text-brand hover:text-sky-200">Ingresar</Link></p>
  </AuthCard></AuthPage>;
}
