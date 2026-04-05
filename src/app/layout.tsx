import type { Metadata } from "next";
import { Noto_Serif, Inter } from "next/font/google";
import Link from "next/link";
import NavigationDrawer from "@/components/NavigationDrawer";
import CartBadge from "@/components/CartBadge";
import SearchOverlay from "@/components/SearchOverlay";
import NavigationLoader from "@/components/NavigationLoader";
import WixChat from "@/components/WixChat";
import MarqueeBanner from "@/components/MarqueeBanner";
import FlyToCart from "@/components/FlyToCart";
import Toast from "@/components/Toast";
import RegionSelector from "@/components/RegionSelector";
import DesktopNav from "@/components/DesktopNav";
import Footer from "@/components/Footer";
import MetaPixel from "@/components/MetaPixel";
import Clarity from "@/components/Clarity";
import CookieConsent from "@/components/CookieConsent";
import MaterialSymbols from "@/components/MaterialSymbols";
import { MemberProvider } from "@/contexts/MemberContext";
import { Analytics } from "@vercel/analytics/react";
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
    default: "SOLITAIREC — Quality Korean and Japanese Fashion",
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
        <link rel="alternate" hrefLang="en-HK" href={SITE_URL} />
        <link rel="alternate" hrefLang="en" href={SITE_URL} />
        <link rel="alternate" hrefLang="x-default" href={SITE_URL} />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
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
        <MemberProvider>
        <MaterialSymbols />
        <NavigationLoader />
        {/* Sticky header — marquee + nav + region bar flow naturally */}
        <header className="sticky top-0 z-50">
          {/* Marquee banner */}
          <MarqueeBanner />
          <div className="bg-white/80 backdrop-blur-xl border-b border-surface-container-high/40">
            {/* Mobile nav */}
            <nav className="flex lg:hidden items-center justify-between px-5 h-14">
              <NavigationDrawer />
              <Link href="/" className="absolute left-1/2 -translate-x-1/2">
                <span className="font-serif font-bold text-lg tracking-[0.3em] text-on-surface">
                  SOLITAIREC
                </span>
              </Link>
              <SearchOverlay />
            </nav>
            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center justify-between px-10 h-14">
              <Link href="/" className="shrink-0">
                <span className="font-serif font-bold text-lg tracking-[0.3em] text-on-surface">
                  SOLITAIREC
                </span>
              </Link>
              <DesktopNav />
              <div className="flex items-center gap-4 shrink-0">
                <Link
                  href="/gift-cards"
                  className="flex items-center justify-center w-10 h-10 text-on-surface hover:text-secondary transition-colors"
                  aria-label="Gift Cards"
                >
                  <span className="material-symbols-outlined text-[22px]">redeem</span>
                </Link>
                <SearchOverlay />
                <CartBadge />
                <Link
                  href="/account"
                  className="flex items-center justify-center w-10 h-10 text-on-surface hover:text-secondary transition-colors"
                  aria-label="Account"
                >
                  <span className="material-symbols-outlined text-[22px]">person</span>
                </Link>
              </div>
            </nav>
          </div>
          {/* Shipping region bar */}
          <div className="bg-surface-container-low/90 backdrop-blur-sm flex justify-center py-1">
            <RegionSelector detectedCountry={detectedCountry} />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 pb-24 lg:pb-0">{children}</main>

        {/* Desktop footer */}
        <Footer />

        {/* Cart feedback animation */}
        <FlyToCart />
        <Toast />

        {/* Chat widget */}
        <WixChat />

        {/* Analytics — Vercel Analytics is privacy-friendly (ungated) */}
        <Analytics />
        {/* Tracking scripts gated behind cookie consent */}
        <CookieConsent>
          <Clarity />
          <MetaPixel />
        </CookieConsent>

        {/* Fixed bottom navigation — mobile only */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-surface-container-high/40 lg:hidden">
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
        </MemberProvider>
      </body>
    </html>
  );
}
