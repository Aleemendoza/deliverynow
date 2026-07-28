"use client";

import { Eye, EyeOff, LoaderCircle, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

type Feedback = { tone: "error" | "success" | "info"; message: string } | null;

const feedbackStyles = {
  error: "border-red-400/30 bg-red-400/10 text-red-100",
  success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  info: "border-brand/30 bg-brand/10 text-sky-50",
};

export function AuthPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-[calc(100vh-1px)] items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(14,165,233,0.14),_transparent_52%)] px-4 py-10 sm:px-6">{children}</main>;
}

export function AuthCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <section className="w-full max-w-[29rem] rounded-3xl border border-white/10 bg-surface/90 p-6 shadow-2xl shadow-black/30 backdrop-blur sm:p-8">
    <p className="text-xs font-bold tracking-[0.16em] text-brand uppercase">{eyebrow}</p>
    <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
    <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
    {children}
  </section>;
}

export function AuthField({ label, icon: Icon, error, children }: { label: string; icon?: LucideIcon; error?: string; children: ReactNode }) {
  const inputId = label.toLowerCase().replace(/[^a-z]+/g, "-");
  return <div className="grid gap-2">
    <label htmlFor={inputId} className="text-sm font-medium text-zinc-200">{label}</label>
    <div className="relative">
      {Icon && <Icon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-500" />}
      {children}
    </div>
    {error && <p id={`${inputId}-error`} role="alert" className="text-sm text-red-300">{error}</p>}
  </div>;
}

export function authInputClass(hasIcon = true, invalid = false) {
  return `min-h-12 w-full rounded-xl border bg-zinc-950/40 py-3 pr-4 text-base text-white outline-none transition placeholder:text-zinc-500 focus:ring-4 ${hasIcon ? "pl-11" : "pl-4"} ${invalid ? "border-red-400/70 focus:border-red-400 focus:ring-red-400/15" : "border-white/10 focus:border-brand focus:ring-brand/15"}`;
}

export function PasswordField({ id, value, onChange, autoComplete, error, placeholder = "Ingresá tu contraseña" }: { id: string; value: string; onChange: (value: string) => void; autoComplete: "current-password" | "new-password"; error?: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="grid gap-2">
    <label htmlFor={id} className="text-sm font-medium text-zinc-200">Contraseña</label>
    <div className="relative">
      <input id={id} name="password" type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} placeholder={placeholder} className={authInputClass(true, Boolean(error))} />
      <button type="button" aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisible((current) => !current)} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
      </button>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-red-300">{error}</p>}
  </div>;
}

export function AuthFeedback({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <div aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm leading-5 ${feedbackStyles[feedback.tone]}`}>{feedback.message}</div>;
}

export function AuthSubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return <button type="submit" disabled={pending} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-bold text-brand-foreground transition hover:bg-sky-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-65">
    {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}{pending ? "Procesando…" : children}
  </button>;
}
