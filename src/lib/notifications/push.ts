import webpush from "web-push";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

function configured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function sendPushToProfile(profileId: string, title: string, body: string, url: string) {
  if (!configured()) return { skipped: true };
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("profile_id", profileId).returns<PushSubscriptionRow[]>();
  await Promise.all((data ?? []).map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title, body, url }));
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
    }
  }));
  return { skipped: false };
}
