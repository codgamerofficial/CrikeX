import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════ QUERIES ═══════

/** Get all markets for a match — real-time subscription */
export const getByMatch = query({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("markets")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();
  },
});

/** Get a single market by marketId */
export const get = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("markets")
      .withIndex("by_marketId", (q) => q.eq("marketId", args.marketId))
      .first();
  },
});

/** Get live odds for a market — clients subscribe to this */
export const getLiveOdds = query({
  args: { marketId: v.string() },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("markets")
      .withIndex("by_marketId", (q) => q.eq("marketId", args.marketId))
      .first();
    if (!market) return null;
    return {
      marketId: market.marketId,
      options: market.options,
      totalStaked: market.totalStaked,
      status: market.status,
    };
  },
});

/** Get odds history for charts */
export const getOddsHistory = query({
  args: { marketId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oddsHistory")
      .withIndex("by_marketId_time", (q) => q.eq("marketId", args.marketId))
      .order("desc")
      .take(args.limit || 50);
  },
});

/** Get user's active bets */
export const getUserBets = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("liveBets")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});

// ═══════ MUTATIONS ═══════

/** Place a bet — core betting engine */
export const placeBet = mutation({
  args: {
    userId: v.string(),
    matchId: v.string(),
    marketId: v.string(),
    selection: v.string(),
    coinsStaked: v.number(),
    externalBetId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Validate market is open
    const market = await ctx.db
      .query("markets")
      .withIndex("by_marketId", (q) => q.eq("marketId", args.marketId))
      .first();

    if (!market) throw new Error("MARKET_NOT_FOUND");
    if (market.status !== "open") throw new Error("MARKET_CLOSED");

    // 2. Find the selected option and get current odds
    const option = market.options.find((o) => o.key === args.selection);
    if (!option) throw new Error("INVALID_SELECTION");

    const oddsAtPlacement = option.odds;
    const potentialPayout = Math.floor(args.coinsStaked * oddsAtPlacement);

    // 3. Create the bet
    const betId = await ctx.db.insert("liveBets", {
      externalBetId: args.externalBetId,
      userId: args.userId,
      matchId: args.matchId,
      marketId: args.marketId,
      selection: args.selection,
      oddsAtPlacement,
      coinsStaked: args.coinsStaked,
      potentialPayout,
      status: "active",
    });

    // 4. Update bet counts and recalculate odds
    const newBetCounts = { ...(market.betCounts || {}) };
    newBetCounts[args.selection] =
      (newBetCounts[args.selection] || 0) + args.coinsStaked;

    const newTotalStaked = (market.totalStaked || 0) + args.coinsStaked;
    const newOptions = recalculateOdds(market.options, newBetCounts, newTotalStaked);

    await ctx.db.patch(market._id, {
      options: newOptions,
      totalStaked: newTotalStaked,
      betCounts: newBetCounts,
    });

    // 5. Log odds history
    for (const opt of newOptions) {
      await ctx.db.insert("oddsHistory", {
        marketId: args.marketId,
        optionKey: opt.key,
        odds: opt.odds,
        timestamp: Date.now(),
      });
    }

    return {
      betId,
      oddsAtPlacement,
      potentialPayout,
      newOdds: newOptions,
    };
  },
});

/** Create or update a market */
export const upsertMarket = mutation({
  args: {
    matchId: v.string(),
    marketId: v.string(),
    type: v.string(),
    description: v.string(),
    options: v.array(
      v.object({ key: v.string(), label: v.string(), odds: v.float64() })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("markets")
      .withIndex("by_marketId", (q) => q.eq("marketId", args.marketId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        options: args.options,
        description: args.description,
      });
      return existing._id;
    }

    return await ctx.db.insert("markets", {
      matchId: args.matchId,
      marketId: args.marketId,
      type: args.type,
      description: args.description,
      options: args.options,
      totalStaked: 0,
      betCounts: {},
      status: "open",
    });
  },
});

/** Settle a market — determine winners */
export const settleMarket = mutation({
  args: {
    marketId: v.string(),
    result: v.string(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("markets")
      .withIndex("by_marketId", (q) => q.eq("marketId", args.marketId))
      .first();

    if (!market) throw new Error("MARKET_NOT_FOUND");
    if (market.status === "settled") throw new Error("ALREADY_SETTLED");

    // Mark market as settled
    await ctx.db.patch(market._id, {
      status: "settled",
      result: args.result,
    });

    // Get all active bets for this market
    const bets = await ctx.db
      .query("liveBets")
      .withIndex("by_marketId", (q) => q.eq("marketId", args.marketId))
      .collect();

    const results = { won: [], lost: [] };

    for (const bet of bets) {
      if (bet.status !== "active") continue;

      const won = bet.selection === args.result;
      await ctx.db.patch(bet._id, {
        status: won ? "won" : "lost",
      });

      if (won) {
        results.won.push({
          betId: bet._id,
          externalBetId: bet.externalBetId,
          userId: bet.userId,
          payout: bet.potentialPayout,
        });
      } else {
        results.lost.push({
          betId: bet._id,
          externalBetId: bet.externalBetId,
          userId: bet.userId,
        });
      }
    }

    return {
      marketId: args.marketId,
      result: args.result,
      totalBets: bets.length,
      winners: results.won.length,
      losers: results.lost.length,
      settlements: results,
    };
  },
});

/** Suspend/resume a market */
export const updateMarketStatus = mutation({
  args: {
    marketId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const market = await ctx.db
      .query("markets")
      .withIndex("by_marketId", (q) => q.eq("marketId", args.marketId))
      .first();

    if (!market) throw new Error("MARKET_NOT_FOUND");
    await ctx.db.patch(market._id, { status: args.status });
  },
});

// ═══════ ODDS ENGINE ═══════

/**
 * Bayesian odds recalculation based on bet distribution.
 * Uses market-making model: odds inversely proportional to bet volume.
 * Includes a 5% house margin (vig).
 */
function recalculateOdds(
  options: Array<{ key: string; label: string; odds: number }>,
  betCounts: Record<string, number>,
  totalStaked: number
): Array<{ key: string; label: string; odds: number }> {
  const HOUSE_MARGIN = 0.05;
  const MIN_ODDS = 1.05;
  const MAX_ODDS = 50.0;

  // If no bets yet, keep original odds
  if (totalStaked === 0) return options;

  return options.map((opt) => {
    const staked = betCounts[opt.key] || 0;
    const impliedProb = staked / totalStaked;

    // Inverse probability with house margin
    let rawOdds = impliedProb > 0 ? (1 / impliedProb) * (1 - HOUSE_MARGIN) : opt.odds;

    // Blend with original odds (weighted: 30% original, 70% market)
    const blendedOdds = opt.odds * 0.3 + rawOdds * 0.7;

    // Clamp
    const finalOdds = Math.min(MAX_ODDS, Math.max(MIN_ODDS, blendedOdds));

    return {
      key: opt.key,
      label: opt.label,
      odds: Math.round(finalOdds * 100) / 100,
    };
  });
}
