import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/lib/auth/session";
import { AccountProfileForm } from "@/components/account/account-profile-form";
import { ProfileExperience } from "@/components/profiles/profile-experience";
import { getProfileExperience } from "@/lib/profiles/experience";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { profile, user } = await requireRole("customer");
  const experience = await getProfileExperience("customer", profile.id);
  return <><SiteHeader/><main className="mx-auto max-w-5xl px-4 py-6 sm:py-10"><ProfileExperience name={profile.full_name || "Cliente"} email={user.email} data={experience}/><section className="mt-5 rounded-2xl border border-white/10 bg-zinc-900 p-4 sm:mt-6 sm:p-6"><h2 className="text-lg font-bold">Datos de la cuenta</h2><p className="mt-1 text-sm text-zinc-400">Tu nombre identifica los pedidos que enviás.</p><AccountProfileForm initialName={profile.full_name}/></section></main></>;
}
