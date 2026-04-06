import type { Metadata } from "next";
import ContactForm from "./ContactForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with SolitaireC. Reach us by email or Instagram DM, or send us a message directly.",
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default function ContactPage() {
  return (
    <section className="px-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Get in Touch
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      {/* Contact methods */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
        {/* Email */}
        <a
          href="mailto:Enquiry@SolitaireC.com"
          className="group flex items-center gap-4 bg-surface-container-low px-6 py-6 transition-colors hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[28px] text-on-surface-variant group-hover:text-secondary transition-colors">
            mail
          </span>
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
              Email
            </p>
            <p className="mt-1 text-sm text-on-surface">
              Enquiry@SolitaireC.com
            </p>
          </div>
        </a>

        {/* Instagram */}
        <a
          href="https://www.instagram.com/solitairec"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 bg-surface-container-low px-6 py-6 transition-colors hover:bg-surface-container"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-on-surface-variant group-hover:text-secondary transition-colors shrink-0"
          >
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
          </svg>
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
              Instagram DM
            </p>
            <p className="mt-1 text-sm text-on-surface">@SolitaireC</p>
          </div>
        </a>
      </div>

      {/* Contact form */}
      <div className="pb-20">
        <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
          Contact Us
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Leave a message and we will respond ASAP
        </p>
        <div className="mt-8">
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
