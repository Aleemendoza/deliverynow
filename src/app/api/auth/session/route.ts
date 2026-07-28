import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sessionSchema = z.object({ accessToken: z.string().min(20), refreshToken: z.string().min(20) });

/** Copies a verified browser session to the SSR cookie store. */
export async function POST(request: NextRequest) {
  const parsed = sessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "La sesión no es válida.", 422);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.setSession({ access_token: parsed.data.accessToken, refresh_token: parsed.data.refreshToken });
  if (error || !data.user) return apiError("SESSION_SYNC_FAILED", "No pudimos validar tu sesión. Iniciá sesión nuevamente.", 401);
  return NextResponse.json({ authenticated: true });
}
