import { getServerWixClient } from "@/lib/wix-server-client";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

const shoeKeywords = ["shoe", "sneaker", "boot", "loafer", "sandal", "heel"];
const bagKeywords = ["bag", "tote", "clutch", "purse", "backpack", "satchel"];

function matchesKeywords(name: string, keywords: string[]) {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function SectionHeading({ title, id }: { title: string; id?: string }) {
  return (
    <div className="pt-28 pb-10" id={id}>
      <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
        {title}
      </h2>
      <div className="mt-3 w-12 h-[2px] bg-secondary" />
    </div>
  );
}

function ProductGrid({
  products,
}: {
  products: {
    _id?: string | null;
    slug?: string | null;
    name?: string | null;
    priceData?: { formatted?: { price?: string | null } | null } | null;
    media?: {
      mainMedia?: { image?: { url?: string | null } | null } | null;
    } | null;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <div key={product._id} className={index % 2 === 1 ? "mt-8" : ""}>
          <ProductCard
            slug={product.slug ?? product._id ?? ""}
            name={product.name ?? "Untitled"}
            price={product.priceData?.formatted?.price ?? "Price unavailable"}
            imageUrl={product.media?.mainMedia?.image?.url}
          />
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const wix = getServerWixClient();

  const { items } = await wix.products.queryProducts().limit(12).find();

  if (items.length === 0) {
    return (
      <section className="px-5">
        <SectionHeading title="New Arrivals" />
        <p className="text-on-surface-variant text-sm">
          No products found. Make sure your Wix credentials are configured in
          .env.local and you have products in your Wix store.
        </p>
      </section>
    );
  }

  const shoes = items.filter((p) =>
    matchesKeywords(p.name ?? "", shoeKeywords)
  );
  const bags = items.filter((p) => matchesKeywords(p.name ?? "", bagKeywords));
  const arrivals = items.filter(
    (p) =>
      !matchesKeywords(p.name ?? "", shoeKeywords) &&
      !matchesKeywords(p.name ?? "", bagKeywords)
  );

  return (
    <section className="px-5">
      {arrivals.length > 0 && (
        <>
          <SectionHeading title="New Arrivals" />
          <ProductGrid products={arrivals} />
        </>
      )}

      {shoes.length > 0 && (
        <>
          <SectionHeading title="Shoes" id="shoes" />
          <ProductGrid products={shoes} />
        </>
      )}

      {bags.length > 0 && (
        <>
          <SectionHeading title="Bags" id="bags" />
          <ProductGrid products={bags} />
        </>
      )}
    </section>
  );
}
