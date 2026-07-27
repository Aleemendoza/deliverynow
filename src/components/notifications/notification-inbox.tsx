"use client";

import { Bell, Check, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PushRegistration } from "@/components/notifications/push-registration";
import { useRealtimeSubscription, realtimeEnabled } from "@/lib/realtime/subscription";
import type { UserRole } from "@/types/domain";

type Notification = { id: string; title: string; body: string; type: string; created_at: string; read_at: string | null; order_id: string | null };
type NotificationResponse = { notifications: Notification[]; unreadCount: number };

const destinationByRole: Record<UserRole, string> = {
  customer: "/mis-pedidos",
  courier: "/courier/orders",
  admin: "/admin",
};

export function NotificationInbox({ role, profileId }: { role: UserRole; profileId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as NotificationResponse;
      setNotifications(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (realtimeEnabled()) return;
    const intervalId = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(intervalId);
  }, [load]);
  useRealtimeSubscription({ topic: `profile:${profileId}`, event: "notification.created", onEvent: load });

  const openNotification = async (notification: Notification) => {
    if (!notification.read_at) {
      const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notification.id }) });
      if (response.ok) {
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    }
    setOpen(false);
    router.push(destinationByRole[role]);
  };

  return <div className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Notificaciones" aria-expanded={open} className="relative rounded-lg border border-white/15 p-2 text-zinc-100 hover:bg-white/5">
      <Bell className="size-4" />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-black text-brand-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </button>
    {open && <section aria-label="Centro de notificaciones" className="absolute right-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-zinc-950 p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Notificaciones</h2><p className="text-xs text-zinc-400">{unreadCount ? `${unreadCount} sin leer` : "Todo al dia"}</p></div>{loading && <LoaderCircle className="size-4 animate-spin text-zinc-400" />}</div>
      <div className="mt-3 max-h-80 overflow-y-auto">{notifications.length ? <ul className="grid gap-2">{notifications.map((notification) => <li key={notification.id}><button type="button" onClick={() => void openNotification(notification)} className={`w-full rounded-lg border p-3 text-left transition hover:bg-white/5 ${notification.read_at ? "border-white/5 text-zinc-400" : "border-brand/30 bg-brand/5"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-zinc-100">{notification.title}</p>{notification.read_at && <Check className="size-4 shrink-0 text-emerald-400" />}</div><p className="mt-1 text-xs">{notification.body}</p><time className="mt-2 block text-[11px] text-zinc-500">{new Date(notification.created_at).toLocaleString("es-AR")}</time></button></li>)}</ul> : <p className="rounded-lg border border-dashed border-white/15 p-4 text-sm text-zinc-400">No tenes notificaciones todavia.</p>}</div>
      <PushRegistration compact />
    </section>}
  </div>;
}
