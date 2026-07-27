import { logOrderDebug } from "@/lib/observability/order-debug";

type OrderEmail = { recipient: string; trackingCode: string; total: number; pickup: string; delivery: string; pin?: string };
type EmailResult = { id: string; skipped?: false } | { skipped: true };

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export async function sendOrderReceivedEmail(order: OrderEmail): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    logOrderDebug("order.email.skipped", { reason: "resend_not_configured" });
    return { skipped: true };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const code = escapeHtml(order.trackingCode);
  const pin = order.pin ? `<p>PIN de entrega: <strong>${escapeHtml(order.pin)}</strong>. No lo compartas con el cadete.</p>` : "";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [order.recipient], subject: `Recibimos tu pedido ${order.trackingCode}`, html: `<h1>Pedido recibido</h1><p>Tu codigo de seguimiento es <strong>${code}</strong>.</p><p>${escapeHtml(order.pickup)} → ${escapeHtml(order.delivery)}</p><p>Total estimado: $${order.total.toLocaleString("es-AR")}</p>${pin}<p><a href="${appUrl}/seguimiento/${encodeURIComponent(order.trackingCode)}">Seguir pedido</a></p>` }),
  });
  if (!response.ok) {
    logOrderDebug("order.email.failed", { status: response.status });
    throw new Error("Resend no pudo enviar el correo");
  }

  const result = await response.json() as { id: string };
  logOrderDebug("order.email.queued", { providerId: result.id });
  return result;
}

export async function sendOrderStatusEmail({ recipient, trackingCode, status }: { recipient: string; trackingCode: string; status: string }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { skipped: true };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [recipient], subject: `Actualizacion de tu pedido ${trackingCode}`, html: `<h1>Actualizacion de pedido</h1><p>El pedido <strong>${escapeHtml(trackingCode)}</strong> ahora esta: <strong>${escapeHtml(status)}</strong>.</p><p><a href="${appUrl}/seguimiento/${encodeURIComponent(trackingCode)}">Ver seguimiento</a></p>` }) });
  if (!response.ok) throw new Error("Resend no pudo enviar el correo de estado");
  return response.json() as Promise<{ id: string }>;
}

export async function sendNotificationEmail({ recipient, title, body, url }: { recipient: string; title: string; body: string; url: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { skipped: true } as const;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const destination = new URL(url, appUrl).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: escapeHtml(title),
      html: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><p><a href="${escapeHtml(destination)}">Ver pedido</a></p>`,
    }),
  });
  if (!response.ok) throw new Error("Resend no pudo enviar la notificaciÃ³n por correo");
  return response.json() as Promise<{ id: string }>;
}
