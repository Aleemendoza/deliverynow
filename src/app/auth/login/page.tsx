import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const homeForRole = { customer: "/account", courier: "/courier", admin: "/admin" } as const;

export default async function Login() {
  const current = await getCurrentUser();
  if (current) redirect(homeForRole[current.profile.role]);
  return <LoginForm/>;
}
