export default function AccountPage() {
  return (
    <section className="px-5">
      <div className="pt-12 pb-10">
        <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Account
        </h2>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      <div className="max-w-md">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          Sign in to view your orders and manage your account.
        </p>

        <button className="mt-8 w-full bg-on-surface text-on-primary py-4 text-xs tracking-[0.2em] uppercase font-medium">
          Sign In
        </button>
      </div>
    </section>
  );
}
