import { getCurrentUser } from "@/lib/auth/session";
import { SiteNavigation } from "@/components/site-navigation";

export async function SiteHeader() {
  const current = await getCurrentUser();
  return <SiteNavigation profile={current ? { id: current.profile.id, fullName: current.profile.full_name, role: current.profile.role } : null} />;
}
