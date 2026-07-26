"use client";

import Link from "next/link";
import { LogIn, LogOut, Menu, PackagePlus, PanelTop, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/domain";

type SessionProfile = { fullName: string | null; role: UserRole } | null;
const publicLinks = [{ href: "/servicios", label: "Servicios" }, { href: "/precios", label: "Precios" }, { href: "/seguimiento", label: "Seguimiento" }];
const roleLinks: Record<UserRole, Array<{ href: string; label: string }>> = {
  customer: [{ href: "/account", label: "Mi cuenta" }, { href: "/solicitar", label: "Nuevo pedido" }],
  courier: [{ href: "/courier", label: "Panel" }, { href: "/courier/orders", label: "Mis pedidos" }],
  admin: [{ href: "/admin", label: "Administración" }],
};

export function SiteNavigation({ profile }: { profile: SessionProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const links = profile ? roleLinks[profile.role] : publicLinks;
  const primaryLink = profile?.role === "customer" ? { href: "/solicitar", label: "Pedir ahora" } : null;
  async function signOut() {
    setSigningOut(true);
    try { await createSupabaseBrowserClient().auth.signOut(); router.replace("/"); router.refresh(); }
    finally { setSigningOut(false); }
  }
  return <header className="sticky top-0 z-20 border-b border-white/10 bg-background/95 backdrop-blur"><nav className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-3"><Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight"><span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-foreground"><PanelTop size={18} /></span><span>Delivery <em className="not-italic text-brand">Now</em></span></Link>
    <div className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">{links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}</div>
    <div className="hidden items-center gap-2 md:flex">{profile ? <><span className="max-w-36 truncate px-2 text-sm text-zinc-300">{profile.fullName || (profile.role === "courier" ? "Cadete" : profile.role === "admin" ? "Administrador" : "Mi cuenta")}</span>{primaryLink && <Link href={primaryLink.href} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-brand-foreground"><Zap className="mr-1 inline size-4"/>{primaryLink.label}</Link>}<button onClick={signOut} disabled={signingOut} className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-50"><LogOut className="mr-1 inline size-4"/>{signingOut ? "Saliendo…" : "Salir"}</button></> : <><Link href="/auth/login" className="rounded-lg px-3 py-2 text-sm"><LogIn className="mr-1 inline size-4" />Ingresar</Link><Link href="/solicitar" className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-brand-foreground"><Zap className="mr-1 inline size-4"/>Pedir ahora</Link></>}</div>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} className="rounded-lg p-2 md:hidden">{open ? <X className="size-5"/> : <Menu className="size-5"/>}</button>
    {open && <div className="basis-full border-t border-white/10 pt-3 md:hidden"><div className="grid gap-1">{links.map((link) => <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/5" key={link.href} href={link.href}>{link.label}</Link>)}{profile ? <><p className="px-3 pt-2 text-xs text-zinc-500">Sesión: {profile.fullName || profile.role}</p><button onClick={signOut} disabled={signingOut} className="mt-1 rounded-lg px-3 py-2 text-left text-sm text-red-300 disabled:opacity-50"><LogOut className="mr-2 inline size-4"/>{signingOut ? "Cerrando sesión…" : "Cerrar sesión"}</button></> : <><Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm" href="/auth/login"><LogIn className="mr-2 inline size-4"/>Ingresar</Link><Link onClick={() => setOpen(false)} className="rounded-lg bg-brand px-3 py-2 text-sm font-bold text-brand-foreground" href="/solicitar"><PackagePlus className="mr-2 inline size-4"/>Pedir ahora</Link></>}</div></div>}</nav></header>;
}
