"use client";

import { useEffect } from "react";

function disableAutofill(root: ParentNode) {
  if (root instanceof HTMLElement) {
    if (root.matches("form:not([data-allow-autocomplete])")) root.setAttribute("autocomplete", "off");
    if (root.matches("input:not([type=hidden]), textarea, select") && !root.closest("[data-allow-autocomplete]")) root.setAttribute("autocomplete", "off");
  }
  root.querySelectorAll("form:not([data-allow-autocomplete])").forEach((form) => form.setAttribute("autocomplete", "off"));
  root.querySelectorAll("input:not([type=hidden]), textarea, select").forEach((field) => {
    if (!field.closest("[data-allow-autocomplete]")) field.setAttribute("autocomplete", "off");
  });
}

export function FormPrivacy() {
  useEffect(() => {
    disableAutofill(document);
    const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) disableAutofill(node);
    })));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
