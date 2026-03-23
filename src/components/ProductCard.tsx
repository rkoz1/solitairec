import Link from "next/link";
import Image from "next/image";
import { getWixImageUrl } from "@/lib/wix-image";

interface ProductCardProps {
  slug: string;
  name: string;
  price: string;
  imageUrl: string | undefined | null;
}

export default function ProductCard({
  slug,
  name,
  price,
  imageUrl,
}: ProductCardProps) {
  const src = getWixImageUrl(imageUrl, 600, 800);

  return (
    <Link href={`/products/${slug}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden bg-surface-container-low">
        <Image
          src={src}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="mt-4">
        <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
          {name}
        </h3>
        <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
          {price}
        </p>
      </div>
    </Link>
  );
}
