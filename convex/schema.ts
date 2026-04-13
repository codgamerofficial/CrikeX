import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════ MATCHES ═══════
  matches: defineTable({
    matchId: v.string(), // external ID (m1, m2, etc.)
    sport: v.string(),
    league: v.string(),
    teamA: v.object({
      name: v.string(),
      short: v.string(),
      color: v.string(),
    }),
    teamB: v.object({
      name: v.string(),
      short: v.string(),
      color: v.string(),
    }),
    venue: v.string(),
    startTime: v.number(), // epoch ms
    status: v.union(
      v.literal("upcoming"),
      v.literal("live"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    scoreData: v.any(), // flexible score object
    result: v.optional(v.string()),
  })
    .index("by_matchId", ["matchId"])
    .index("by_status", ["status"])
    .index("by_startTime", ["startTime"]),

  // ═══════ MARKETS (Betting Markets) ═══════
  markets: defineTable({
    matchId: v.string(), // links to matches.matchId
    marketId: v.string(), // external ID (mk1, mk2, etc.)
    type: v.string(), // match_winner, top_scorer, total_runs, etc.
    description: v.string(),
    options: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        odds: v.float64(),
      })
    ),
    totalStaked: v.number(),
    betCounts: v.any(), // { "team_a": 150, "team_b": 90, ... }
    status: v.union(
      v.literal("open"),
      v.literal("suspended"),
      v.literal("settled"),
      v.literal("voided")
    ),
    result: v.optional(v.string()),
  })
    .index("by_matchId", ["matchId"])
    .index("by_marketId", ["marketId"])
    .index("by_status", ["status"]),

  // ═══════ LIVE BETS (Real-time state) ═══════
  liveBets: defineTable({
    externalBetId: v.optional(v.string()), // UUID from Nhost
    userId: v.string(),
    matchId: v.string(),
    marketId: v.string(),
    selection: v.string(),
    oddsAtPlacement: v.float64(),
    coinsStaked: v.number(),
    potentialPayout: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("won"),
      v.literal("lost"),
      v.literal("voided")
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_marketId", ["marketId"])
    .index("by_matchId", ["matchId"])
    .index("by_status", ["status"]),

  // ═══════ ODDS HISTORY ═══════
  oddsHistory: defineTable({
    marketId: v.string(),
    optionKey: v.string(),
    odds: v.float64(),
    timestamp: v.number(),
  })
    .index("by_marketId", ["marketId"])
    .index("by_marketId_time", ["marketId", "timestamp"]),

  // ═══════ MATCH EVENTS (Live commentary feed) ═══════
  matchEvents: defineTable({
    matchId: v.string(),
    type: v.string(), // wicket, boundary, over_complete, timeout, etc.
    data: v.any(),
    timestamp: v.number(),
  })
    .index("by_matchId", ["matchId"])
    .index("by_matchId_time", ["matchId", "timestamp"]),
});
