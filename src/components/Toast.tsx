"use client";

import { useState, useEffect, useCallback } from "react";
import type { ToastType } from "@/lib/toast";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 0;

const ICONS: Record<ToastType, string> = {
  error: "error",
  success: "check_circle",
  info: "info",
};

export default function Toast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const handleToast = useCallback((e: Event) => {
    const { message, type } = (e as CustomEvent).detail as {
      message: string;
      type: ToastType;
    };
    const id = nextId++;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    window.addEventListener("show-toast", handleToast);
    return () => window.removeEventListener("show-toast", handleToast);
  }, [handleToast]);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-[5.5rem] left-1/2 -translate-x-1/2 z-[55] flex flex-col gap-2 items-center">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-on-surface text-on-primary px-5 py-3 flex items-center gap-2.5 shadow-lg animate-[slideUp_200ms_ease-out] max-w-[90vw]"
        >
          <span
            className={`material-symbols-outlined text-[16px] shrink-0 ${
              item.type === "error"
                ? "text-secondary"
                : item.type === "success"
                  ? "text-secondary"
                  : "text-on-primary/70"
            }`}
          >
            {ICONS[item.type]}
          </span>
          <p className="text-[10px] tracking-[0.15em] uppercase font-medium leading-relaxed">
            {item.message}
          </p>
        </div>
      ))}
    </div>
  );
}
