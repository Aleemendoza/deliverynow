import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/session";
import { AccountProfileForm } from "@/components/account/account-profile-form";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { profile, user } = await requireRole("customer");
  return <><SiteHeader/><main className="mx-auto max-w-3xl px-4 py-10"><p className="font-bold text-brand">MI CUENTA</p><h1 className="mt-2 text-3xl font-bold">Hola, {profile.full_name || "cliente"}</h1><section className="mt-7 rounded-2xl border border-white/10 bg-zinc-900 p-6"><h2 className="text-lg font-bold">Datos de acceso</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-zinc-400">Correo</dt><dd className="mt-1 font-medium">{user.email}</dd></div><div><dt className="text-zinc-400">Perfil</dt><dd className="mt-1 font-medium">Cliente</dd></div></dl><AccountProfileForm initialName={profile.full_name}/></section><a href="/solicitar" className="mt-6 inline-block rounded-lg bg-brand px-4 py-3 text-sm font-bold text-brand-foreground">Solicitar un envío</a></main></>;
}
