import { getServerWixClient } from "@/lib/wix-server-client";
import ProductCard from "@/components/ProductCard";

interface CompleteTheLookProps {
  currentProductId: string;
}

export default async function CompleteTheLook({
  currentProductId,
}: CompleteTheLookProps) {
  let products;
  try {
    const wix = getServerWixClient();
    const { items } = await wix.products.queryProducts().limit(12).find();
    products = items.filter((p) => p._id !== currentProductId);
  } catch {
    return null;
  }

  if (!products || products.length < 2) return null;

  // Shuffle and take 4
  const shuffled = products.sort(() => Math.random() - 0.5).slice(0, 4);

  return (
    <section className="mt-28 px-6 lg:px-8 lg:max-w-6xl lg:mx-auto">
      <h2 className="font-serif italic text-2xl tracking-tight text-on-surface mb-8">
        Complete the Look
      </h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar">
        {shuffled.map((product) => (
          <div key={product._id} className="w-40 flex-shrink-0">
            <ProductCard
              slug={product.slug ?? ""}
              name={product.name ?? ""}
              price={product.priceData?.formatted?.price ?? ""}
              imageUrl={product.media?.mainMedia?.image?.url}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
