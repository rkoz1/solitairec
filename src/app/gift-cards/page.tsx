import GiftCardForm from "./GiftCardForm";

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
