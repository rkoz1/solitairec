import Link from "next/link";

const SHOP_LINKS = [
  { href: "/collections/new-arrivals", label: "New Arrivals" },
  { href: "/collections/top", label: "Tops" },
  { href: "/collections/bottoms", label: "Bottoms" },
  { href: "/collections/dresses", label: "Dresses" },
  { href: "/collections/outer", label: "Outers" },
  { href: "/collections/shoes", label: "Shoes" },
  { href: "/collections/bags", label: "Handbags" },
  { href: "/collections/accessories", label: "Accessories" },
];

const INFO_LINKS = [
  { href: "/our-mission", label: "Our Mission" },
  { href: "/gift-cards", label: "Gift Cards" },
  { href: "/loyalty", label: "Rewards Programme" },
  { href: "/refer-friends", label: "Refer a Friend" },
  { href: "/terms", label: "Terms & Conditions" },
];

export default function Footer() {
  return (
    <footer className="hidden lg:block bg-surface-container-low mt-28">
      <div className="max-w-7xl mx-auto px-10 py-16">
        <div className="grid grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <span className="font-serif font-bold text-lg tracking-[0.3em] text-on-surface">
              SOLITAIREC
            </span>
            <p className="mt-4 text-xs leading-relaxed text-on-surface-variant tracking-wide">
              Curated Japanese and Korean fashion, based in Hong Kong.
              Thoughtfully selected pieces for the modern wardrobe.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-[10px] tracking-[0.25em] uppercase font-bold text-on-surface mb-4">
              Shop
            </h3>
            <ul className="space-y-2.5">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs tracking-wide text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="text-[10px] tracking-[0.25em] uppercase font-bold text-on-surface mb-4">
              Information
            </h3>
            <ul className="space-y-2.5">
              {INFO_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs tracking-wide text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-[10px] tracking-[0.25em] uppercase font-bold text-on-surface mb-4">
              Connect
            </h3>
            <a
              href="https://www.instagram.com/solitairec"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs tracking-wide text-on-surface-variant hover:text-secondary transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              Instagram
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-14 pt-6 border-t border-outline-variant/20">
          <p className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
            &copy; {new Date().getFullYear()} SolitaireC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
