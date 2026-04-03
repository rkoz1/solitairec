import { NextResponse } from "next/server";
import { getServerWixClient } from "@/lib/wix-server-client";
import { getWixImageUrl } from "@/lib/wix-image";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

export async function GET() {
  try {
    const wix = getServerWixClient();
    const allProducts: Record<string, unknown>[] = [];
    let offset = 0;
    const PAGE_SIZE = 100;

    while (true) {
      const { items } = await wix.products
        .queryProducts()
        .limit(PAGE_SIZE)
        .skip(offset)
        .find();

      allProducts.push(...(items as unknown as Record<string, unknown>[]));
      if (items.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    const items = allProducts
      .map((p) => {
        const slug = p.slug as string | undefined;
        const name = p.name as string | undefined;
        const id = p._id as string | undefined;
        if (!slug || !name || !id) return null;

        const stock = p.stock as { inventoryStatus?: string } | undefined;
        const availability =
          stock?.inventoryStatus === "OUT_OF_STOCK"
            ? "out of stock"
            : "in stock";

        const priceData = p.priceData as {
          price?: number;
          currency?: string;
          discountedPrice?: number;
        } | undefined;
        const price = priceData?.price ?? 0;
        const currency = priceData?.currency ?? "HKD";
        const salePrice = priceData?.discountedPrice;

        const description = p.description
          ? stripHtml(p.description as string).slice(0, 5000)
          : name;

        const media = p.media as {
          mainMedia?: { image?: { url?: string } };
          items?: { image?: { url?: string } }[];
        } | undefined;
        const imageUrl = getWixImageUrl(media?.mainMedia?.image?.url, 1200, 630);

        const additionalImages = (media?.items ?? [])
          .slice(1, 4)
          .map((m) => getWixImageUrl(m.image?.url, 1200, 630));

        const link = `${SITE_URL}/products/${slug}`;

        let itemXml = `    <item>
      <g:id>${escapeXml(id)}</g:id>
      <g:title>${escapeXml(name)}</g:title>
      <g:description>${escapeXml(description)}</g:description>
      <g:link>${escapeXml(link)}</g:link>
      <g:image_link>${escapeXml(imageUrl)}</g:image_link>
${additionalImages.map((img) => `      <g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`).join("\n")}
      <g:availability>${availability}</g:availability>
      <g:price>${price.toFixed(2)} ${currency}</g:price>
${salePrice && salePrice < price ? `      <g:sale_price>${salePrice.toFixed(2)} ${currency}</g:sale_price>\n` : ""}      <g:brand>SOLITAIREC</g:brand>
      <g:condition>new</g:condition>
    </item>`;

        return itemXml;
      })
      .filter(Boolean);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>SOLITAIREC Product Catalog</title>
    <link>${SITE_URL}</link>
    <description>Curated Korean and Japanese fashion from Hong Kong</description>
${items.join("\n")}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    console.error("Product feed generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate feed" },
      { status: 500 }
    );
  }
}
