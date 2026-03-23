export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Image from "next/image";
import { getServerWixClient } from "@/lib/wix-server-client";
import { getWixImageUrl } from "@/lib/wix-image";
import ImageCarousel from "@/components/ImageCarousel";
import CompleteTheLook from "@/components/CompleteTheLook";
import ProductInfo from "./ProductInfo";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const wix = getServerWixClient();

  const { items } = await wix.products
    .queryProducts()
    .eq("slug", slug)
    .limit(1)
    .find();

  const product = items[0];
  if (!product) notFound();

  const mainImage = getWixImageUrl(
    product.media?.mainMedia?.image?.url,
    800,
    1067
  );

  const mainMediaUrl = product.media?.mainMedia?.image?.url;
  const additionalImages =
    product.media?.items
      ?.filter(
        (item) =>
          item.image && item.image.url !== mainMediaUrl
      )
      .map((item) => getWixImageUrl(item.image?.url, 800, 1067)) ?? [];

  const allImages = [mainImage, ...additionalImages.slice(0, 5)];

  return (
    <>
      <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-8">
        {/* Image gallery */}
        <div className="relative">
          {/* Mobile: interactive carousel with dots */}
          <div className="lg:hidden">
            <ImageCarousel
              images={allImages}
              productName={product.name ?? "Product"}
            />
          </div>
          {/* Desktop: vertical image stack */}
          <div className="hidden lg:block space-y-4">
            {allImages.map((src, i) => (
              <div
                key={i}
                className="relative aspect-[3/4] bg-surface-container-low"
              >
                <Image
                  src={src}
                  alt={`${product.name ?? "Product"} ${i + 1}`}
                  fill
                  sizes="50vw"
                  className="object-cover"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Product info */}
        <div className="mt-12 px-6 lg:mt-0 lg:px-0 lg:py-8 lg:sticky lg:top-24 lg:self-start">
          {/* Brand / collection label */}
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary">
            {product.brand || "Collection"}
          </p>

          {/* Name */}
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-on-surface">
            {product.name}
          </h1>

          {/* Ribbon badge */}
          {product.ribbon && (
            <span className="mt-3 inline-block text-[10px] tracking-[0.2em] uppercase font-medium text-secondary border border-secondary px-3 py-1">
              {product.ribbon}
            </span>
          )}

          {/* Price */}
          <p className="mt-3 text-lg tracking-tight text-on-surface-variant">
            {product.priceData?.formatted?.price ?? "Price unavailable"}
          </p>

          {/* Variant selectors + Add to Cart (client component) */}
          <ProductInfo
            productId={product._id ?? ""}
            productOptions={product.productOptions ?? []}
          />

          {/* Description — editorial layout */}
          {product.description && (
            <div className="mt-16 space-y-10">
              <div className="pb-8 border-b border-outline-variant/30">
                <h3 className="font-serif italic text-xl tracking-tight text-on-surface mb-4">
                  The Narrative
                </h3>
                <div
                  className="text-sm leading-relaxed text-on-surface-variant"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </div>
              {(product.additionalInfoSections?.length ?? 0) > 0 ? (
                product.additionalInfoSections!.map((section) => (
                  <div key={section.title} className="pb-8 border-b border-outline-variant/30">
                    <h3 className="font-serif italic text-xl tracking-tight text-on-surface mb-4">
                      {section.title}
                    </h3>
                    <div
                      className="text-sm leading-relaxed text-on-surface-variant"
                      dangerouslySetInnerHTML={{ __html: section.description ?? "" }}
                    />
                  </div>
                ))
              ) : (
                <div className="pb-8 border-b border-outline-variant/30">
                  <h3 className="font-serif italic text-xl tracking-tight text-on-surface mb-4">
                    Design Details
                  </h3>
                  <ul className="text-sm leading-relaxed text-on-surface-variant space-y-2">
                    <li>Crafted with premium materials</li>
                    <li>Designed for everyday elegance</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Complete the Look — cross-sell */}
      <CompleteTheLook currentProductId={product._id ?? ""} />
    </>
  );
}
