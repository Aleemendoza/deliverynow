import { sendNotificationEmail } from "@/lib/notifications/email";
import { sendPushToProfile } from "@/lib/notifications/push";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type OutboxRow = {
  id: string;
  user_id: string | null;
  channel: "push" | "email";
  recipient_email: string | null;
  title: string;
  body: string;
  url: string;
  attempt_count: number;
};

type DispatchResult = { claimed: number; sent: number; failed: number; skipped: number };

const retryDelaySeconds = (attempt: number) => Math.min(60 * 60, 30 * 2 ** Math.min(attempt, 7));

export async function dispatchNotificationOutbox(batchSize = 25): Promise<DispatchResult> {
  const database = getSupabaseServerClient();
  const workerId = crypto.randomUUID();
  const { data, error } = await database.rpc("claim_notification_outbox", { batch_size: batchSize, worker_id_value: workerId });
  if (error) throw new Error("No se pudo reclamar la cola de notificaciones");

  const rows = (data ?? []) as OutboxRow[];
  const result: DispatchResult = { claimed: rows.length, sent: 0, failed: 0, skipped: 0 };
  for (const row of rows) {
    try {
      if (row.channel === "push") {
        if (!row.user_id) throw new Error("El destino push no tiene usuario");
        const push = await sendPushToProfile(row.user_id, row.title, row.body, row.url);
        if (push.skipped) {
          await complete(database, row.id, workerId, "sent", "Push no configurado; se conserva la notificaciÃ³n in-app.");
          result.skipped += 1;
        } else {
          await complete(database, row.id, workerId, "sent");
          result.sent += 1;
        }
      } else {
        if (!row.recipient_email) {
          await complete(database, row.id, workerId, "sent", "El usuario no tiene correo configurado.");
          result.skipped += 1;
          continue;
        }
        const email = await sendNotificationEmail({ recipient: row.recipient_email, title: row.title, body: row.body, url: row.url });
        const skipped = "skipped" in email && email.skipped;
        await complete(database, row.id, workerId, "sent", skipped ? "Correo no configurado; se conserva la notificación in-app." : undefined);
        if (skipped) result.skipped += 1;
        else result.sent += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Error desconocido al despachar la notificaciÃ³n";
      const delay = retryDelaySeconds(row.attempt_count);
      await finalize(database, row.id, workerId, "failed", message, new Date(Date.now() + delay * 1000).toISOString());
      result.failed += 1;
    }
  }
  return result;
}

async function complete(database: ReturnType<typeof getSupabaseServerClient>, id: string, workerId: string, status: "sent", note?: string) {
  await finalize(database, id, workerId, status, note);
}

async function finalize(database: ReturnType<typeof getSupabaseServerClient>, id: string, workerId: string, outcome: "sent" | "failed", note?: string, retryAt?: string) {
  const { error } = await database.rpc("finalize_notification_outbox", {
    outbox_id_value: id,
    worker_id_value: workerId,
    outcome_value: outcome,
    error_value: note ?? null,
    retry_at_value: retryAt ?? null,
  });
  if (error) throw error;
}
