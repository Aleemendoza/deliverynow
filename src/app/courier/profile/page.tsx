import { ProfileExperience } from "@/components/profiles/profile-experience";
import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/session";
import { getProfileExperience } from "@/lib/profiles/experience";

export const dynamic = "force-dynamic";

export default async function CourierProfilePage() {
  const { profile, user } = await requireRole("courier");
  const experience = await getProfileExperience("courier", profile.id);
  return <><SiteHeader/><main className="mx-auto max-w-5xl px-4 py-10"><ProfileExperience name={profile.full_name || "Cadete"} email={user.email} data={experience}/><section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900 p-6"><h2 className="text-lg font-bold">Tu desempeño</h2><p className="mt-2 text-sm text-zinc-400">Cada entrega completada suma experiencia. Mantené tu disponibilidad actualizada desde el panel para recibir nuevas asignaciones.</p></section></main></>;
}
