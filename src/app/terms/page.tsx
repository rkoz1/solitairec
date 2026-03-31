import type { Metadata } from "next";
import NewsletterSignup from "@/components/NewsletterSignup";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Delivery, exchange, refund policies, and product care instructions for SolitaireC.",
};

export default function TermsPage() {
  return (
    <section className="px-5 max-w-2xl mx-auto">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Terms &amp; Conditions
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      <div className="space-y-12">
        {/* Delivery */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Delivery
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Locally: SF EXPRESS and Internationally: DHL, Fedex, HK Post office
            international service &amp; SF Express delivery are used.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Please fill in SF Express / EF locker / SF locker branch code and
            district at the Address field at checkout if you prefer self-pick up.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Orders are usually shipped between 3–14 business working days
            subject to item availability.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            We cannot guarantee shipping time after posting the parcel, due to
            time taken and rules for clearance and customs being respectively
            different in different countries. Refund will not be considered due
            to delayed shipping time.
          </p>
        </div>

        {/* Shoes Exchange */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Shoes Exchange
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            All shoes are entitled for size change once as long as they are
            returned in brand new, unworn &amp; undamaged condition (including
            original shoe box if any).
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Pictures of items are taken before sending to customers as proof that
            they are non-defective.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            For any reason for exchange, please return the shoes within 5 days
            after the parcel has been dispatched to you. Later than 5 days will
            not be considered for exchange.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Customers will be responsible for one-way return postage fee if
            requiring a size exchange. If the shoe size purchased is already the
            smallest or biggest, customers may exchange for another item by
            settling the price difference.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Please contact us before purchase if you are unsure about whether
            certain designs run small or big. Contact us by email:{" "}
            <a
              href="mailto:enquiry@solitairec.com"
              className="underline text-secondary"
            >
              enquiry@solitairec.com
            </a>{" "}
            or on Chatbox / Contact Form on the website or direct message us on
            Instagram:{" "}
            <a
              href="https://www.instagram.com/solitairec"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-secondary"
            >
              @SolitaireC
            </a>
          </p>
        </div>

        {/* Clothing Items Exchange */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Clothing Items Exchange
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Exchange is not provided for clothing items due to colour
            difference — possible colour difference due to lighting or digital
            device use.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            All clothing items can be exchanged once if they come with different
            sizes. If items only come with one size, no exchange will be
            provided.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            We kindly suggest customers check measurement details below the
            product images before adding to cart. Measurements can differ
            2–3 cm.
          </p>
        </div>

        {/* Defects */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Defects
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            If items are received with defects or stains, please kindly reach
            out to us within 5 days after the item has been delivered, by email:{" "}
            <a
              href="mailto:enquiry@solitairec.com"
              className="underline text-secondary"
            >
              enquiry@solitairec.com
            </a>{" "}
            or message us on the Chatbox / Contact Form or on Instagram:{" "}
            <a
              href="https://www.instagram.com/solitairec"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-secondary"
            >
              @SolitaireC
            </a>
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Please make sure your return item comes with the original tag (if
            any) so that we can facilitate a smooth exchange process. A brand new
            item will be ordered for you.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Customer will be paying one-way delivery fee when returning. Unpaid
            parcels will not be collected and will be returned to sender.
          </p>
        </div>

        {/* Refund */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Refund
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Only items that are out of stock will be refunded. Once an order is
            placed, refund will not be considered due to any other reason.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            SolitaireC holds the right for final decision. For any enquiry
            please reach out to us.
          </p>
        </div>

        {/* Product Care */}
        <div className="space-y-4">
          <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
            Product Care
          </h2>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Always clean or wash clothing items with water not higher than
            30°C. No drying with heat.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Never apply water, alcohol wet wipes, or chemicals on any leather
            products (e.g. shoes, bags, belts). No washing for synthetic leather
            jackets.
          </p>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Always iron delicate clothing items with a piece of fabric on top to
            prevent direct heat from any type of ironing or pressing, which may
            leave heat marks on the fabrics. Avoid high heat ironing, as it may
            damage the fabric structure.
          </p>
        </div>
      </div>

      <NewsletterSignup />
    </section>
  );
}
