import type { CustomerTier, LoyaltySettings } from '@/types';

export const DEFAULT_LOYALTY_TIERS: LoyaltySettings['tiers'] = {
    Silver: { points: 500, discount: 5 },
    Gold: { points: 2000, discount: 10 },
};

/**
 * Resolves the tier a customer's point total qualifies for. A tier whose
 * threshold hasn't been configured (0 or unset — e.g. the admin left the
 * "Points to Reach Tier" field blank in Settings) is treated as unreachable
 * rather than "everyone with >= 0 points qualifies", which would otherwise
 * promote every customer to that tier on their very next paid invoice.
 */
export function resolveLoyaltyTier(points: number, tiers: LoyaltySettings['tiers']): CustomerTier {
    if (tiers.Gold.points > 0 && points >= tiers.Gold.points) return 'Gold';
    if (tiers.Silver.points > 0 && points >= tiers.Silver.points) return 'Silver';
    return 'Bronze';
}
