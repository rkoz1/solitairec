export const revalidate = 600;

import type { Metadata } from "next";
import { displayName } from "@/lib/collections";
import { getCollectionBySlug } from "@/lib/collections";
import { fetchCollectionProducts } from "../actions";
import { getWixImageUrl } from "@/lib/wix-image";
import CollectionClient from "./CollectionClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) return {};

  const name = displayName(collection.name ?? slug);
  const description = (collection.description as string | undefined)
    ?? `Shop ${name} at SOLITAIREC. Curated selection of high-quality designer pieces.`;

  // Use collection media for OG, fall back to first product image
  const collectionImage = (collection as { media?: { mainMedia?: { image?: { url?: string } } } })
    .media?.mainMedia?.image?.url;
  let ogImage: string | undefined;
  if (collectionImage) {
    ogImage = getWixImageUrl(collectionImage, 1200, 630);
  } else {
    // Fetch products to get first image as fallback
    const data = await fetchCollectionProducts(slug);
    if (data?.products[0]?.imageUrl) {
      ogImage = data.products[0].imageUrl;
    }
  }

  return {
    title: name,
    description,
    alternates: {
      canonical: `${SITE_URL}/collections/${slug}`,
    },
    openGraph: {
      title: `${name} | SOLITAIREC`,
      description,
      url: `${SITE_URL}/collections/${slug}`,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const initialData = await fetchCollectionProducts(slug);
  const collection = await getCollectionBySlug(slug);
  const name = displayName(collection?.name ?? slug);

  // Build ItemList JSON-LD for the collection
  const itemListElements = (initialData?.products ?? []).slice(0, 30).map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `${SITE_URL}/products/${p.slug}`,
    name: p.name,
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name,
            url: `${SITE_URL}/collections/${slug}`,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: initialData?.products.length ?? 0,
              itemListElement: itemListElements,
            },
          }),
        }}
      />
      <CollectionClient slug={slug} initialData={initialData} />
    </>
  );
}
