import { getCurrentUser } from "@/lib/auth/session";
import { SiteNavigation } from "@/components/site-navigation";
import { AutoRefresh } from "@/components/system/auto-refresh";

export async function SiteHeader() {
  const current = await getCurrentUser();
  return <><AutoRefresh/><SiteNavigation profile={current ? { id: current.profile.id, fullName: current.profile.full_name, role: current.profile.role } : null} /></>;
}
