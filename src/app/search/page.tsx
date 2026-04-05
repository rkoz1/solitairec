import type { Metadata } from "next";
import SearchClient from "./SearchClient";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  if (!query) {
    return {
      title: "Search",
      description: "Search the SOLITAIREC collection for luxury clothing and accessories.",
      alternates: { canonical: `${SITE_URL}/search` },
    };
  }

  return {
    title: `Results for "${query}"`,
    description: `Shop results for "${query}" at SOLITAIREC. Find curated designer pieces.`,
    alternates: { canonical: `${SITE_URL}/search?q=${encodeURIComponent(query)}` },
    openGraph: {
      title: `Results for "${query}" | SOLITAIREC`,
      description: `Shop results for "${query}" at SOLITAIREC.`,
      url: `${SITE_URL}/search?q=${encodeURIComponent(query)}`,
    },
  };
}

export default function SearchPage() {
  return <SearchClient />;
}
