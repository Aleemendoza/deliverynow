import Link from "next/link";
import { changeUserRole } from "../actions";
import { requireRole } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";

const PAGE_SIZE = 50;
const roleLabel = { customer: "Usuario", courier: "Cadete", admin: "Administrador" };
type SearchParams = Promise<{ notice?: string; error?: string; page?: string }>;
type Profile = { id: string; full_name: string | null; email: string | null; phone_e164: string | null; role: "customer" | "courier" | "admin"; created_at: string; couriers: Array<{ is_active: boolean; is_online: boolean }> | null };

export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: SearchParams }) {
  await requireRole("admin");
  const params = await searchParams;
  const pageValue = Number(params.page);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const from = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await getSupabaseServerClient().from("profiles").select("id,full_name,email,phone_e164,role,created_at,couriers(is_active,is_online)", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const profiles = (data ?? []) as Profile[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return <><SiteHeader /><main className="mx-auto max-w-6xl px-4 py-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-bold text-sky-400">ADMINISTRACION</p><h1 className="mt-2 text-3xl font-bold">Usuarios y roles</h1><p className="mt-2 max-w-2xl text-sm text-zinc-400">Promove usuarios a cadetes o devolvelos al rol de usuario. Al promover se activa su perfil operativo y al quitar el rol se desactiva su disponibilidad.</p></div><Link href="/admin" className="w-fit text-sm font-bold text-sky-300">Volver a operacion</Link></header>
    {params.notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{params.notice}</p>}
    {params.error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{params.error}</p>}
    {error ? <p role="alert" className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">No pudimos cargar los usuarios. Intenta nuevamente.</p> : <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-900 p-4 sm:p-5"><div><h2 className="text-lg font-bold">Cuentas registradas</h2><p className="mt-1 text-sm text-zinc-400">{count ?? 0} usuarios en total. Pagina {page} de {totalPages}.</p></div><div className="mt-5 grid gap-3 md:hidden">{profiles.map((profile) => <UserCard key={profile.id} profile={profile} />)}</div><div className="mt-5 hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase text-zinc-400"><tr><th className="pb-3 pr-4">Usuario</th><th className="pb-3 pr-4">Contacto</th><th className="pb-3 pr-4">Rol</th><th className="pb-3">Accion</th></tr></thead><tbody>{profiles.length ? profiles.map((profile) => <tr className="border-b border-white/5" key={profile.id}><td className="py-4 pr-4"><p className="font-semibold">{profile.full_name || "Sin nombre"}</p><p className="mt-1 text-xs text-zinc-500">Registrado {new Date(profile.created_at).toLocaleDateString("es-AR")}</p></td><td className="py-4 pr-4"><p>{profile.email || "Sin correo"}</p><p className="mt-1 text-xs text-zinc-500">{profile.phone_e164 || "Sin telefono"}</p></td><td className="py-4 pr-4"><RoleBadge profile={profile} /></td><td className="py-4"><RoleForm profile={profile} /></td></tr>) : <tr><td colSpan={4} className="py-8 text-center text-zinc-400">No hay usuarios en esta pagina.</td></tr>}</tbody></table></div><Pagination page={page} totalPages={totalPages} /></section>}
  </main></>;
}

function RoleBadge({ profile }: { profile: Profile }) { const courier = profile.couriers?.[0]; return <div><span className={profile.role === "courier" ? "rounded-full bg-sky-400/15 px-2 py-1 text-xs font-semibold text-sky-300" : profile.role === "admin" ? "rounded-full bg-violet-400/15 px-2 py-1 text-xs font-semibold text-violet-300" : "rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-zinc-300"}>{roleLabel[profile.role]}</span>{profile.role === "courier" && <p className="mt-2 text-xs text-zinc-500">{courier?.is_active ? courier.is_online ? "Activo · online" : "Activo · offline" : "Inactivo"}</p>}</div>; }
function RoleForm({ profile }: { profile: Profile }) { if (profile.role === "admin") return <span className="text-xs text-zinc-500">Protegido</span>; return <form action={changeUserRole} className="flex items-center gap-2"><input type="hidden" name="profileId" value={profile.id} /><select aria-label={`Rol de ${profile.full_name || profile.email || "usuario"}`} name="role" defaultValue={profile.role} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm"><option value="customer">Usuario</option><option value="courier">Cadete</option></select><button className="rounded-lg border border-sky-400/60 px-3 py-2 text-xs font-bold text-sky-300">Guardar</button></form>; }
function UserCard({ profile }: { profile: Profile }) { return <article className="rounded-xl border border-white/10 bg-black/15 p-4"><p className="font-bold">{profile.full_name || "Sin nombre"}</p><p className="mt-1 break-all text-sm text-zinc-400">{profile.email || "Sin correo"}</p><p className="mt-1 text-xs text-zinc-500">{profile.phone_e164 || "Sin telefono"}</p><div className="mt-4 flex items-center justify-between gap-3"><RoleBadge profile={profile} /><RoleForm profile={profile} /></div></article>; }
function Pagination({ page, totalPages }: { page: number; totalPages: number }) { if (totalPages <= 1) return null; return <nav aria-label="Paginacion de usuarios" className="mt-5 flex justify-between border-t border-white/10 pt-4 text-sm font-bold"><Link aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none text-zinc-600" : "text-sky-300"} href={`/admin/users?page=${page - 1}`}>Anterior</Link><Link aria-disabled={page >= totalPages} className={page >= totalPages ? "pointer-events-none text-zinc-600" : "text-sky-300"} href={`/admin/users?page=${page + 1}`}>Siguiente</Link></nav>; }
