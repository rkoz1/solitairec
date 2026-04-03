export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { getServerWixClient } from "@/lib/wix-server-client";

export const metadata: Metadata = {
  title: "Rewards Programme",
  description:
    "Earn points on every purchase. Redeem for exclusive rewards and discounts at SolitaireC.",
};

interface EarningRule {
  title?: string;
  status?: string;
  fixedAmount?: { configs?: { points?: number; tierId?: string | null }[] };
  conversionRate?: {
    configs?: { moneyAmount?: number; points?: number; tierId?: string | null }[];
  };
}

interface Tier {
  _id?: string | null;
  tierDefinition?: { name?: string; description?: string; icon?: string };
  requiredPoints?: number;
}

interface Reward {
  name?: string;
  active?: boolean;
  discountAmount?: {
    configsByTier?: { amount?: string; costInPoints?: number; tierId?: string | null }[];
  };
}

export default async function LoyaltyPage() {
  let program = null;
  let rules: EarningRule[] = [];
  let tiers: Tier[] = [];
  let rewards: Reward[] = [];
  let tierSettings: unknown = null;

  try {
    const wix = getServerWixClient();

    const [programResult, rulesResult, tiersResult, rewardsResult, tierSettingsResult] =
      await Promise.all([
        wix.loyaltyPrograms.getLoyaltyProgram().catch(() => null),
        wix.earningRules.listEarningRules().catch(() => ({ earningRules: [] })),
        wix.loyaltyTiers.listTiers().catch(() => ({ tiers: [] })),
        wix.loyaltyRewards.listRewards().catch(() => ({ rewards: [] })),
        wix.loyaltyTiers.getTiersProgramSettings().catch(() => null),
      ]);

    program = programResult ?? null;
    rules = (rulesResult?.earningRules ?? []) as EarningRule[];
    tiers = (tiersResult?.tiers ?? []) as Tier[];
    rewards = (rewardsResult?.rewards ?? []) as Reward[];
    tierSettings = tierSettingsResult;
  } catch (err) {
    console.error("Failed to load loyalty program:", err);
  }

  const activeRules = rules.filter((r) => r.status === "ACTIVE");
  const activeRewards = rewards.filter((r) => r.active);

  // Prepend base tier (e.g. "Green") at 0 points
  const settings = tierSettings as {
    programSettings?: { baseTierDefinition?: { name?: string; description?: string } };
  } | null;
  const baseTierName = settings?.programSettings?.baseTierDefinition?.name;
  const baseTierDesc = settings?.programSettings?.baseTierDefinition?.description;
  const baseTier: Tier = baseTierName
    ? { _id: "base", tierDefinition: { name: baseTierName, description: baseTierDesc ?? undefined }, requiredPoints: 0 }
    : null as unknown as Tier;

  const allTiers = baseTier ? [baseTier, ...tiers] : [...tiers];
  const sortedTiers = allTiers.sort(
    (a, b) => (a.requiredPoints ?? 0) - (b.requiredPoints ?? 0)
  );

  return (
    <section className="px-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Rewards Programme
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      {!program ? (
        <p className="text-sm text-on-surface-variant">
          Our rewards programme is coming soon.
        </p>
      ) : (
        <div className="space-y-16">
          {/* How it works */}
          <div>
            <h2 className="font-serif italic text-xl tracking-tight text-on-surface mb-6">
              How It Works
            </h2>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Earn points on every purchase and activity. Redeem your points for
              exclusive rewards and discounts. The more you shop, the more you
              earn.
            </p>
          </div>

          {/* Earning rules */}
          {activeRules.length > 0 && (
            <div>
              <h2 className="font-serif italic text-xl tracking-tight text-on-surface mb-6">
                Ways to Earn
              </h2>
              <div className="space-y-2">
                {activeRules.map((rule, i) => {
                  const fixedPts = rule.fixedAmount?.configs?.[0]?.points;
                  const conv = rule.conversionRate?.configs?.[0];

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-surface-container-low px-5 py-4"
                    >
                      <span className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                        {rule.title ?? "Activity"}
                      </span>
                      <span className="text-[10px] tracking-widest text-secondary font-medium">
                        {fixedPts
                          ? `${fixedPts} pts`
                          : conv
                            ? `${conv.points} pts / HK$${conv.moneyAmount}`
                            : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tiers */}
          {sortedTiers.length > 0 && (
            <div>
              <h2 className="font-serif italic text-xl tracking-tight text-on-surface mb-6">
                Membership Tiers
              </h2>
              <div className="space-y-2">
                {sortedTiers.map((tier) => (
                  <div
                    key={tier._id}
                    className="bg-surface-container-low px-5 py-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                        {tier.tierDefinition?.name ?? "Tier"}
                      </span>
                      <span className="text-[10px] tracking-widest text-secondary font-medium">
                        {(tier.requiredPoints ?? 0).toLocaleString()} pts
                      </span>
                    </div>
                    {tier.tierDefinition?.description && (
                      <p className="mt-2 text-[10px] tracking-widest text-on-surface-variant">
                        {tier.tierDefinition.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rewards */}
          {activeRewards.length > 0 && (
            <div>
              <h2 className="font-serif italic text-xl tracking-tight text-on-surface mb-6">
                Available Rewards
              </h2>
              <div className="space-y-2">
                {activeRewards.map((reward, i) => {
                  const config = reward.discountAmount?.configsByTier?.[0];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-surface-container-low px-5 py-4"
                    >
                      <span className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                        {reward.name ?? "Reward"}
                      </span>
                      {config && (
                        <span className="text-[10px] tracking-widest text-secondary font-medium">
                          {config.costInPoints?.toLocaleString()} pts → HK${config.amount} off
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="text-center pb-8">
            <Link
              href="/account"
              className="inline-block bg-on-surface text-on-primary px-10 py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
            >
              View My Rewards
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
