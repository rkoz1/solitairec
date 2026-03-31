import type { Metadata } from "next";
import { Noto_Serif, Inter } from "next/font/google";
import Link from "next/link";
import NavigationDrawer from "@/components/NavigationDrawer";
import CartBadge from "@/components/CartBadge";
import SearchOverlay from "@/components/SearchOverlay";
import NavigationLoader from "@/components/NavigationLoader";
import WixChat from "@/components/WixChat";
import FlyToCart from "@/components/FlyToCart";
import Toast from "@/components/Toast";
import RegionSelector from "@/components/RegionSelector";
import { headers } from "next/headers";
import "./globals.css";

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SOLITAIREC — Editorial Luxury Clothing Store",
    template: "%s | SOLITAIREC",
  },
  description:
    "Curated selection of high-quality designer brands. Minimalistic and unique clothing, shoes, handbags, and accessories from Hong Kong.",
  openGraph: {
    siteName: "SOLITAIREC",
    locale: "en_HK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const detectedCountry =
    headersList.get("x-vercel-ip-country") ??
    headersList.get("cloudflare-ipcountry") ??
    "HK";

  return (
    <html
      lang="en"
      className={`${notoSerif.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "SOLITAIREC",
              url: SITE_URL,
              logo: `${SITE_URL}/favicon.ico`,
              sameAs: ["https://www.instagram.com/solitairec"],
              description:
                "Curated selection of high-quality designer brands from Hong Kong. Clothing, shoes, handbags, and accessories.",
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-surface text-on-surface font-sans">
        <NavigationLoader />
        {/* Frosted glass header */}
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-surface-container-high/40">
          <nav className="flex items-center justify-between px-5 h-14">
            <NavigationDrawer />

            <Link href="/" className="absolute left-1/2 -translate-x-1/2">
              <span className="font-serif font-bold text-lg tracking-[0.3em] text-on-surface">
                SOLITAIREC
              </span>
            </Link>

            <SearchOverlay />
          </nav>
        </header>

        {/* Shipping region bar — below header */}
        <div className="fixed top-14 left-0 right-0 z-40 bg-surface-container-low/90 backdrop-blur-sm flex justify-center py-1">
          <RegionSelector detectedCountry={detectedCountry} />
        </div>

        {/* Main content with padding for fixed header/footer + region bar */}
        <main className="flex-1 pt-[4.5rem] pb-24">{children}</main>

        {/* Cart feedback animation */}
        <FlyToCart />
        <Toast />

        {/* Chat widget */}
        <WixChat />

        {/* Fixed bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-surface-container-high/40">
          <div className="flex items-center justify-around h-16">
            <Link
              href="/"
              className="flex flex-col items-center gap-0.5 text-on-surface"
            >
              <span className="material-symbols-outlined text-[22px]">
                storefront
              </span>
              <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
                Shop
              </span>
            </Link>
            <CartBadge label="Bag" />
            <Link
              href="/account"
              className="flex flex-col items-center gap-0.5 text-on-surface"
            >
              <span className="material-symbols-outlined text-[22px]">
                person
              </span>
              <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
                Account
              </span>
            </Link>
          </div>
        </nav>
      </body>
    </html>
  );
}
