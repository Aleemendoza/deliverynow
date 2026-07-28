"use client";

import { useEffect } from "react";
import { synchronizeBrowserSession } from "@/lib/auth/authenticated-fetch";

/** Keeps SSR cookies aligned when a browser-authenticated user opens the app. */
export function SessionSync() {
  useEffect(() => {
    void synchronizeBrowserSession().catch(() => {
      // Protected mutations surface the authentication error to the user.
    });
  }, []);
  return null;
}
