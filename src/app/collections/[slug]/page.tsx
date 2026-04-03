export const revalidate = 600;

import type { Metadata } from "next";
import { displayName } from "@/lib/collections";
import { getCollectionBySlug } from "@/lib/collections";
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
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  return <CollectionClient slug={slug} />;
}
