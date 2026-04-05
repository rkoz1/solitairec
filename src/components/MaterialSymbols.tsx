"use client";

import { useEffect, useState } from "react";

const FONT_URL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap";

/**
 * Loads Material Symbols font non-blockingly after hydration.
 * Prevents the external stylesheet from blocking LCP.
 */
export default function MaterialSymbols() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_URL;
    link.onload = () => setLoaded(true);
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Reserve space for icons to avoid CLS while font loads
  if (!loaded) {
    return (
      <style
        dangerouslySetInnerHTML={{
          __html: `.material-symbols-outlined { font-family: sans-serif; font-size: inherit; visibility: hidden; }`,
        }}
      />
    );
  }

  return null;
}
