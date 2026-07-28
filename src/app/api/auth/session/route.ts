import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sessionSchema = z.object({ accessToken: z.string().min(20) });

/**
 * Verifies the browser access token without consuming its refresh token.
 * Refresh-token rotation belongs exclusively to the Supabase browser client;
 * doing it again on the server can invalidate the browser's stored session.
 */
export async function POST(request: NextRequest) {
  const parsed = sessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "La sesión no es válida.", 422);

  const supabase = await createSupabaseServerClient(request);
  const { data, error } = await supabase.auth.getUser(parsed.data.accessToken);
  if (error || !data.user) return apiError("SESSION_VALIDATION_FAILED", "Tu sesión venció. Iniciá sesión nuevamente.", 401);
  return NextResponse.json({ authenticated: true, validUntil: Date.now() + 60 * 60 * 1000 });
}
