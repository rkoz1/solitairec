import Link from "next/link";
import { getWixImageUrl } from "@/lib/wix-image";
import ProductCardActions from "./ProductCardActions";
import Price from "./Price";

interface ProductCardProps {
  slug: string;
  name: string;
  price: string;
  priceAmount?: number;
  imageUrl: string | undefined | null;
  priority?: boolean;
  productId?: string;
  productOptions?: { name: string; choices: { value: string; description: string }[] }[];
}

export default function ProductCard({
  slug,
  name,
  price,
  priceAmount,
  imageUrl,
  priority = false,
  productId,
  productOptions,
}: ProductCardProps) {
  const src = getWixImageUrl(imageUrl, 600, 800);

  // Extract color swatches from product options
  const colorOption = productOptions?.find(
    (opt) => opt.choices[0]?.value && /^(#|rgb)/.test(opt.choices[0].value)
  );
  const colors = colorOption?.choices.slice(0, 5);

  return (
    <div className="group">
      {/* Image container — actions overlay here */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-container-low" data-product-id={productId}>
        <Link href={`/products/${slug}`} className="absolute inset-0 z-10">
          <img
            src={src}
            alt={name}
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </Link>

        {/* Color swatches — bottom-left */}
        {colors && colors.length > 0 && (
          <div className="absolute bottom-2.5 left-2.5 z-20 flex gap-1">
            {colors.map((choice) => (
              <span
                key={choice.value}
                className="w-3.5 h-3.5 ring-1 ring-white/80 shadow-sm"
                style={{ backgroundColor: choice.value }}
                title={choice.description || choice.value}
              />
            ))}
          </div>
        )}

        {/* Action icons — over image, above the link */}
        {productId && (
          <ProductCardActions
            productId={productId}
            productName={name}
            productPrice={price}
            productImage={src}
            productOptions={productOptions}
          />
        )}
      </div>

      {/* Text below image */}
      <Link href={`/products/${slug}`} className="block mt-4">
        <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
          {name}
        </h3>
        <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
          {priceAmount != null ? <Price amount={priceAmount} /> : price}
        </p>
      </Link>
    </div>
  );
}
