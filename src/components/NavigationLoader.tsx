"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function NavigationLoader() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  // Hide overlay and scroll to top when pathname changes (navigation complete)
  useEffect(() => {
    setLoading(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  // Listen for internal link clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      // Ignore modified clicks (new tab, etc.)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }

      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore external links, hash-only, target="_blank"
      if (anchor.target === "_blank") return;
      if (href.startsWith("http") || href.startsWith("mailto:")) return;
      if (href.startsWith("#")) return;

      // Ignore same-page links
      if (href === window.location.pathname) return;

      setLoading(true);
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Safety timeout — auto-hide after 8s
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setLoading(false), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface">
      <span className="font-serif font-bold text-4xl tracking-[0.3em] text-on-surface animate-brand-pulse select-none">
        S
      </span>
    </div>
  );
}
