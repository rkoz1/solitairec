import Link from "next/link";
import Image from "next/image";
import { getWixImageUrl } from "@/lib/wix-image";
import ProductCardActions from "./ProductCardActions";

interface ProductCardProps {
  slug: string;
  name: string;
  price: string;
  imageUrl: string | undefined | null;
  priority?: boolean;
  productId?: string;
  productOptions?: { name: string; choices: { value: string; description: string }[] }[];
}

export default function ProductCard({
  slug,
  name,
  price,
  imageUrl,
  priority = false,
  productId,
  productOptions,
}: ProductCardProps) {
  const src = getWixImageUrl(imageUrl, 600, 800);

  return (
    <div className="group">
      {/* Image container — actions overlay here */}
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-container-low" data-product-id={productId}>
        <Link href={`/products/${slug}`} className="absolute inset-0 z-10">
          <Image
            src={src}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority={priority}
          />
        </Link>

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
          {price}
        </p>
      </Link>
    </div>
  );
}
