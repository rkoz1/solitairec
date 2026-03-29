interface FreeShippingBarProps {
  subtotal: number;
  threshold: number;
}

export default function FreeShippingBar({
  subtotal,
  threshold,
}: FreeShippingBarProps) {
  if (threshold <= 0) return null;

  const achieved = subtotal > threshold;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min((subtotal / threshold) * 100, 100);

  return (
    <div className="py-4">
      {achieved ? (
        <div className="flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-secondary">
            check_circle
          </span>
          <p className="text-[11px] tracking-[0.15em] uppercase font-medium text-secondary">
            Free shipping unlocked
          </p>
        </div>
      ) : (
        <>
          <p className="text-[11px] tracking-[0.15em] text-center text-on-surface-variant mb-2">
            <span className="font-medium text-on-surface">
              HK${remaining.toLocaleString()}
            </span>{" "}
            away from free shipping
          </p>
          <div className="h-1 bg-surface-container overflow-hidden">
            <div
              className="h-full bg-secondary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
