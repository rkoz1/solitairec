import type { Metadata } from "next";
import GiftCardForm from "./GiftCardForm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

export const metadata: Metadata = {
  title: "Gift Cards",
  description:
    "Give the gift of style. Purchase SolitaireC gift cards with bonus credits. Valid for 12 months.",
  alternates: { canonical: `${SITE_URL}/gift-cards` },
};

export default function GiftCardsPage() {
  return (
    <section className="px-5 max-w-2xl mx-auto">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Gift Cards
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      <GiftCardForm />
    </section>
  );
}
