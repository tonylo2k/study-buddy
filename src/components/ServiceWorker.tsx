"use client";
import { useEffect } from "react";

const ROUTES = ["/", "/practice", "/pack", "/activity", "/snap", "/test", "/checklist", "/parent", "/parent/settings"];

/** Registers the offline cache in production builds and asks it to pre-save every screen. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => reg.active?.postMessage({ type: "warm", routes: ROUTES }))
      .catch(() => {});
  }, []);
  return null;
}
