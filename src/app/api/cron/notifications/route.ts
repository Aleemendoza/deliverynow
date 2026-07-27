import { NextRequest, NextResponse } from "next/server";
import { dispatchNotificationOutbox } from "@/lib/notifications/dispatch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function dispatch(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "No autorizado." }, { status: 401 });
  }

  try {
    const [result, cleanup] = await Promise.all([
      dispatchNotificationOutbox(),
      getSupabaseServerClient().rpc("cleanup_tracking_realtime_sessions"),
    ]);
    if (cleanup.error) throw cleanup.error;
    return NextResponse.json({ ...result, expiredTrackingSessions: cleanup.data ?? 0 });
  } catch (error) {
    console.error("No se pudo despachar la cola de notificaciones.", error);
    return NextResponse.json({ code: "NOTIFICATION_DISPATCH_FAILED", message: "No se pudo despachar la cola." }, { status: 503 });
  }
}

// Vercel Cron invokes the configured path with GET. POST remains available for
// an authenticated manual retry from operational tooling.
export const GET = dispatch;
export const POST = dispatch;
