import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════ QUERIES (Real-time reactive) ═══════

/** Get all matches, optionally filtered by status */
export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("matches")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .collect();
    }
    return await ctx.db.query("matches").order("desc").collect();
  },
});

/** Get a single match by matchId — real-time subscription */
export const get = query({
  args: { matchId: v.string() },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .collect();
    return matches[0] || null;
  },
});

/** Get live matches — real-time subscription */
export const getLive = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("matches")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .collect();
  },
});

/** Get match events (live commentary) */
export const getEvents = query({
  args: { matchId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("matchEvents")
      .withIndex("by_matchId_time", (q) => q.eq("matchId", args.matchId))
      .order("desc")
      .take(args.limit || 20);
    return events;
  },
});

// ═══════ MUTATIONS (Admin/System) ═══════

/** Create or update a match */
export const upsert = mutation({
  args: {
    matchId: v.string(),
    sport: v.string(),
    league: v.string(),
    teamA: v.object({ name: v.string(), short: v.string(), color: v.string() }),
    teamB: v.object({ name: v.string(), short: v.string(), color: v.string() }),
    venue: v.string(),
    startTime: v.number(),
    status: v.string(),
    scoreData: v.optional(v.any()),
    result: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        scoreData: args.scoreData || existing.scoreData,
        result: args.result,
      });
      return existing._id;
    }

    return await ctx.db.insert("matches", {
      matchId: args.matchId,
      sport: args.sport,
      league: args.league,
      teamA: args.teamA,
      teamB: args.teamB,
      venue: args.venue,
      startTime: args.startTime,
      status: args.status,
      scoreData: args.scoreData || {},
      result: args.result,
    });
  },
});

/** Update live score — triggers real-time push to all subscribers */
export const updateScore = mutation({
  args: {
    matchId: v.string(),
    scoreData: v.any(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();

    if (!match) throw new Error("MATCH_NOT_FOUND");
    await ctx.db.patch(match._id, { scoreData: args.scoreData });

    // Log event
    await ctx.db.insert("matchEvents", {
      matchId: args.matchId,
      type: "score_update",
      data: args.scoreData,
      timestamp: Date.now(),
    });
  },
});

/** Change match status (upcoming → live → completed) */
export const updateStatus = mutation({
  args: {
    matchId: v.string(),
    status: v.string(),
    result: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db
      .query("matches")
      .withIndex("by_matchId", (q) => q.eq("matchId", args.matchId))
      .first();

    if (!match) throw new Error("MATCH_NOT_FOUND");
    await ctx.db.patch(match._id, {
      status: args.status,
      result: args.result,
    });

    await ctx.db.insert("matchEvents", {
      matchId: args.matchId,
      type: "status_change",
      data: { from: match.status, to: args.status, result: args.result },
      timestamp: Date.now(),
    });
  },
});

/** Add a live match event (wicket, boundary, etc.) */
export const addEvent = mutation({
  args: {
    matchId: v.string(),
    type: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("matchEvents", {
      matchId: args.matchId,
      type: args.type,
      data: args.data,
      timestamp: Date.now(),
    });
  },
});
