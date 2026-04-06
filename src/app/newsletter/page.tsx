import type { Metadata } from "next";
import NewsletterSignup from "@/components/NewsletterSignup";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

export const metadata: Metadata = {
  title: "Newsletter",
  description:
    "Subscribe to the SolitaireC newsletter. Be the first to know about new arrivals, exclusive offers, and editorial stories.",
  alternates: { canonical: `${SITE_URL}/newsletter` },
};

export default function NewsletterPage() {
  return (
    <section className="px-5 max-w-2xl mx-auto">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Newsletter
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      <NewsletterSignup alwaysShow />
    </section>
  );
}
