import type { Metadata } from "next";
import NewsletterSignup from "@/components/NewsletterSignup";

export const metadata: Metadata = {
  title: "Our Mission",
  description:
    "SolitaireC offers a curated selection of high-quality designer brands, minimalistic and unique products that embody effortlessly stylish sophistication.",
};

export default function OurMissionPage() {
  return (
    <section className="px-5 max-w-2xl mx-auto">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Our Mission
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      <div className="space-y-10">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          SolitaireC started 5 years ago, offers a curated selection of
          high-quality designer brands, minimalistic and unique products that
          embody the essence of effortlessly stylish sophistication. You are
          here because you are style-conscious and refuse fast fashion.
        </p>

        <p className="text-sm leading-relaxed text-on-surface-variant">
          We offer distinctive collections of fashionable items, our range
          includes clothing, shoes, handbags, and accessories, each known for
          its unique design and exceptional quality. We take pride in featuring
          handmade genuine leather bags and shoes, crafted with meticulous
          attention to detail and a focus on durability and style, ensuring they
          are suitable for all occasions.
        </p>

        <p className="text-sm leading-relaxed text-on-surface-variant">
          Committed to enhancing sustainability in fashion, we prioritize
          curating quality products that stand the test of time, reducing waste
          and promoting longevity.
        </p>

        <p className="text-sm leading-relaxed text-on-surface-variant">
          Customer satisfaction is paramount to us, and we strive to provide an
          exceptional shopping experience. By choosing SolitaireC, you join a
          community that values style, sophistication, and sustainable fashion
          practices.
        </p>

        <p className="text-sm leading-relaxed text-on-surface-variant">
          Sign up today and discover SolitaireC, it is the premier destination
          for those who appreciate timeless elegance and responsible fashion.
        </p>
      </div>

      <NewsletterSignup />
    </section>
  );
}
