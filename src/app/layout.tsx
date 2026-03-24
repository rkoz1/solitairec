import type { Metadata } from "next";
import { Noto_Serif, Inter } from "next/font/google";
import Link from "next/link";
import NavigationDrawer from "@/components/NavigationDrawer";
import CartBadge from "@/components/CartBadge";
import NavigationLoader from "@/components/NavigationLoader";
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

export const metadata: Metadata = {
  title: "SOLITAIREC",
  description: "SolitaireC — Clothing Store",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

            <CartBadge />
          </nav>
        </header>

        {/* Main content with padding for fixed header/footer */}
        <main className="flex-1 pt-16 pb-24">{children}</main>

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
