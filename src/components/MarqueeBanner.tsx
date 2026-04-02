import { getServerWixClient } from "@/lib/wix-server-client";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

async function getBannerContent() {
  try {
    const wix = getServerWixClient();
    const result = await wix.dataItems
      .query("WebsiteContent")
      .eq("id", 1)
      .find();

    const item = result.items[0];
    if (!item || item._publishStatus !== "PUBLISHED") return null;

    const title = item.title_fld as string | undefined;
    const description = item.description_fld as string | undefined;
    if (!title && !description) return null;

    return {
      title: title ?? "",
      description: description ? stripHtml(description) : "",
    };
  } catch {
    return null;
  }
}

export default async function MarqueeBanner() {
  const content = await getBannerContent();
  if (!content) return null;

  const text = [content.title, content.description]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="bg-on-surface text-on-primary overflow-hidden whitespace-nowrap">
      <div className="animate-marquee inline-block py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="text-[10px] tracking-[0.3em] uppercase font-medium mx-12"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
