import type { Metadata } from "next";
import { getServerWixClient } from "@/lib/wix-server-client";
import { displayName } from "@/lib/collections";
import CollectionClient from "./CollectionClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getCollection(slug: string) {
  try {
    const wix = getServerWixClient();
    const result = await wix.collections.getCollectionBySlug(slug);
    return result.collection ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollection(slug);
  if (!collection) return {};

  const name = displayName(collection.name ?? slug);
  const description = (collection.description as string | undefined)
    ?? `Shop ${name} at SOLITAIREC. Curated selection of high-quality designer pieces.`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} | SOLITAIREC`,
      description,
    },
  };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  return <CollectionClient slug={slug} />;
}
