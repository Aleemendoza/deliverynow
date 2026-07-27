"use client";

import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function ScrollToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 240);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  return <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Volver al inicio" className="fixed bottom-5 right-4 z-30 grid size-12 place-items-center rounded-full bg-brand text-brand-foreground shadow-lg shadow-black/30 transition hover:bg-brand-strong focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-background sm:bottom-6 sm:right-6"><ArrowUp className="size-5" aria-hidden="true"/></button>;
}
