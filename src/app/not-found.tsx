import Link from "next/link";

export default function NotFound() {
  return (
    <section className="px-6 pt-16 pb-24 max-w-lg mx-auto text-center">
      <span className="material-symbols-outlined text-[48px] text-on-surface-variant">
        search_off
      </span>

      <h1 className="mt-6 font-serif italic text-2xl tracking-tight text-on-surface">
        Page Not Found
      </h1>
      <div className="mt-3 mx-auto w-12 h-[2px] bg-secondary" />

      <p className="mt-8 text-sm leading-relaxed text-on-surface-variant">
        The page you're looking for doesn't exist or has been moved.
      </p>

      <div className="mt-12 space-y-4">
        <Link
          href="/"
          className="block w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
        >
          Continue Shopping
        </Link>
        <Link
          href="/contact"
          className="block text-xs tracking-[0.15em] uppercase font-medium text-on-surface-variant underline underline-offset-4 hover:text-on-surface transition-colors"
        >
          Contact Us
        </Link>
      </div>
    </section>
  );
}
