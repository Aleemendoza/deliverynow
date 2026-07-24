import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/types/domain";

const protectedRoles: Record<string, UserRole> = { "/courier": "courier", "/admin": "admin" };

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const requiredRole = Object.entries(protectedRoles).find(([path]) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))?.[1];
  if (requiredRole) {
    if (!user) return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: UserRole }>();
    if (profile?.role !== requiredRole) return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = { matcher: ["/courier/:path*", "/admin/:path*", "/auth/:path*"] };
