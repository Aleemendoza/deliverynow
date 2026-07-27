import { ProfileExperience } from "@/components/profiles/profile-experience";
import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/session";
import { getProfileExperience } from "@/lib/profiles/experience";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const { profile, user } = await requireRole("admin");
  const experience = await getProfileExperience("admin", profile.id);
  return <><SiteHeader/><main className="mx-auto max-w-5xl px-4 py-6 sm:py-10"><ProfileExperience name={profile.full_name || "Administrador"} email={user.email} data={experience}/><section className="mt-5 rounded-2xl border border-white/10 bg-zinc-900 p-4 sm:mt-6 sm:p-6"><h2 className="text-lg font-bold">Impacto operativo</h2><p className="mt-2 text-sm text-zinc-400">El nivel administrativo refleja los pedidos gestionados y las operaciones completadas por la plataforma.</p></section></main></>;
}
