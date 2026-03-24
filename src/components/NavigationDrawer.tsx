"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

const navLinks = [
  { label: "Collections", href: "/", icon: "arrow_forward" },
  { label: "Shoes", href: "/#shoes", icon: "arrow_forward" },
  { label: "Bags", href: "/#bags", icon: "arrow_forward" },
  { label: "Account", href: "/account", icon: "arrow_forward" },
];

export default function NavigationDrawer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const overlay = open ? (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Top bar */}
      <div className="relative flex items-center justify-between px-5 h-14">
        <button
          type="button"
          aria-label="Close menu"
          className="flex items-center justify-center w-10 h-10"
          onClick={() => setOpen(false)}
        >
          <span className="material-symbols-outlined text-on-surface">
            close
          </span>
        </button>

        <span className="absolute left-1/2 -translate-x-1/2 font-serif font-bold text-lg tracking-[0.3em] text-on-surface">
          SOLITAIREC
        </span>

        <Link
          href="/cart"
          className="flex items-center justify-center w-10 h-10"
          onClick={() => setOpen(false)}
        >
          <span className="material-symbols-outlined text-on-surface">
            shopping_bag
          </span>
        </Link>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 flex flex-col justify-center px-12 space-y-6">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="group flex items-center justify-between text-on-surface transition-transform duration-500 hover:translate-x-2"
            onClick={() => setOpen(false)}
          >
            <span className="font-serif text-4xl lg:text-6xl tracking-tighter">
              {link.label}
            </span>
            <span className="material-symbols-outlined text-xl opacity-0 group-hover:opacity-100 transition-opacity">
              {link.icon}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        aria-label="Menu"
        className="flex items-center justify-center w-10 h-10"
        onClick={() => setOpen(true)}
      >
        <span className="material-symbols-outlined text-on-surface">menu</span>
      </button>

      {mounted && overlay && createPortal(overlay, document.body)}
    </>
  );
}
