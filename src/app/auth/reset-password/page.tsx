"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPassword() {
  const [message, setMessage] = useState("");
  const submit = async (form: FormData) => { const password = String(form.get("password")); if (password !== String(form.get("confirmation"))) { setMessage("Las contraseñas no coinciden."); return; } const { error } = await createSupabaseBrowserClient().auth.updateUser({ password }); setMessage(error ? error.message : "Contraseña actualizada. Ya podés iniciar sesión."); };
  return <main className="mx-auto max-w-md px-4 py-20"><h1 className="text-3xl font-bold">Nueva contraseña</h1><form autoComplete="off" action={submit} className="mt-7 grid gap-3"><input autoComplete="off" required minLength={8} name="password" type="password" placeholder="Nueva contraseña" className="rounded-lg bg-zinc-900 px-4 py-3"/><input autoComplete="off" required minLength={8} name="confirmation" type="password" placeholder="Repetir contraseña" className="rounded-lg bg-zinc-900 px-4 py-3"/><button className="rounded-lg bg-yellow-400 py-3 font-bold text-black">Actualizar contraseña</button></form>{message && <p role="status" className="mt-4 text-sm text-zinc-300">{message}</p>}</main>;
}
