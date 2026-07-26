"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AccountProfileForm({ initialName }: { initialName: string | null }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(formData: FormData) {
    const fullName = String(formData.get("fullName") ?? "").trim().replace(/\s+/g, " ");
    if (fullName.length < 4) { setMessage("Ingresá tu nombre y apellido."); return; }
    setSaving(true); setMessage("");
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("Tu sesión venció. Iniciá sesión nuevamente."); setSaving(false); return; }
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    setMessage(error ? "No se pudo guardar tu nombre." : "Datos actualizados. Ya podés solicitar un envío."); setSaving(false);
  }
  return <form autoComplete="off" action={save} className="mt-5 grid gap-3"><label className="grid gap-1 text-sm font-medium">Nombre y apellido<input autoComplete="off" required name="fullName" defaultValue={initialName ?? ""} minLength={4} maxLength={80} className="rounded-lg bg-zinc-800 px-3 py-3"/></label><button disabled={saving} className="w-fit rounded-lg bg-brand px-4 py-3 text-sm font-bold text-brand-foreground disabled:opacity-50">{saving ? "Guardando…" : "Guardar datos"}</button>{message && <p role="status" className="text-sm text-zinc-300">{message}</p>}</form>;
}
