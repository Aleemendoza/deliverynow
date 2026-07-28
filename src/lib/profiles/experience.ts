import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getCourierOperationalProfile } from "@/lib/couriers/operational-profile";
import type { UserRole } from "@/types/domain";

type OrderRow = { tracking_code: string; status: string; created_at: string; final_price: number | null; estimated_price: number | null };
export type ProfileExperienceData = { role: UserRole; total: number; completed: number; active: number; points: number; level: string; nextLevel: string; nextLevelPoints: number; recent: Array<{ code: string; status: string; createdAt: string; amount: number | null }>; highlightLabel: string; highlightValue: string };

const activeStatuses = new Set(["assigned", "heading_to_pickup", "at_pickup", "picked_up", "heading_to_delivery", "at_delivery", "incident", "confirmed", "pending_confirmation"]);
const levels = [{ name: "Bronce", at: 0 }, { name: "Plata", at: 300 }, { name: "Oro", at: 800 }, { name: "Platino", at: 1500 }, { name: "Élite", at: 3000 }];

function experience(role: UserRole, total: number, completed: number) {
  const points = role === "courier" ? completed * 125 + total * 15 : role === "admin" ? completed * 20 + total * 2 : completed * 100 + total * 10;
  const current = [...levels].reverse().find((level) => points >= level.at) ?? levels[0];
  const next = levels.find((level) => level.at > points);
  return { points, level: current.name, nextLevel: next?.name ?? "Máximo nivel", nextLevelPoints: next?.at ?? current.at };
}

function toRecent(rows: OrderRow[]) { return rows.slice(0, 6).map((order) => ({ code: order.tracking_code, status: order.status, createdAt: order.created_at, amount: order.final_price ?? order.estimated_price })); }

export async function getProfileExperience(role: UserRole, profileId: string): Promise<ProfileExperienceData> {
  const database = getSupabaseServerClient();
  let rows: OrderRow[] = [];
  let highlightLabel = ""; let highlightValue = "";
  if (role === "customer") {
    const { data: customer } = await database.from("customers").select("id").eq("profile_id", profileId).maybeSingle<{ id: string }>();
    if (customer) { const { data } = await database.from("orders").select("tracking_code,status,created_at,final_price,estimated_price").eq("customer_id", customer.id).order("created_at", { ascending: false }); rows = data ?? []; }
    highlightLabel = "Beneficio actual"; highlightValue = "Seguimiento prioritario";
  } else if (role === "courier") {
    const { data: courier } = await getCourierOperationalProfile(profileId);
    if (courier) { const { data } = await database.from("orders").select("tracking_code,status,created_at,final_price,estimated_price").eq("assigned_courier_id", courier.id).order("created_at", { ascending: false }); rows = data ?? []; highlightValue = courier.transport_type; }
    highlightLabel = "Movilidad"; highlightValue ||= "Sin configurar";
  } else {
    const { data } = await database.from("orders").select("tracking_code,status,created_at,final_price,estimated_price").order("created_at", { ascending: false }).limit(100); rows = data ?? [];
    const { count: couriersOnline } = await database.from("couriers").select("id", { count: "exact", head: true }).eq("is_online", true).eq("is_active", true);
    highlightLabel = "Cadetes online"; highlightValue = String(couriersOnline ?? 0);
  }
  const completed = rows.filter((order) => order.status === "delivered").length;
  const active = rows.filter((order) => activeStatuses.has(order.status)).length;
  const level = experience(role, rows.length, completed);
  return { role, total: rows.length, completed, active, ...level, recent: toRecent(rows), highlightLabel, highlightValue };
}
