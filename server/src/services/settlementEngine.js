// ═══════════════════════════════════════════════════════════════
// CrikeX — Bet Settlement Engine
// ═══════════════════════════════════════════════════════════════

import { v4 as uuid } from 'uuid';
import { predictions, wallets, transactions, markets, leaderboardEntries } from '../data/store.js';
import logger from '../utils/logger.js';
import redis from './redis.js';

export class SettlementEngine {
  constructor() {
    this.settledCount = 0;
  }

  // ── Settle a Single Market ──
  async settleMarket(marketId, result) {
    const market = markets.find(mk => mk.id === marketId);
    if (!market) throw new Error(`Market ${marketId} not found`);
    if (market.status === 'settled') throw new Error(`Market ${marketId} already settled`);

    logger.info(`Settling market ${marketId}`, { type: market.type, result });

    market.result = result;
    market.status = 'settled';
    market.settledAt = new Date();

    // Find all active predictions for this market
    let totalSettled = 0;
    let totalWinners = 0;
    let totalPayouts = 0;

    for (const [userId, userPreds] of predictions.entries()) {
      for (const pred of userPreds) {
        if (pred.marketId !== marketId || pred.status !== 'active') continue;

        if (pred.selection === result) {
          // Winner
          pred.status = 'won';
          pred.payoutCoins = Math.floor(pred.coinsStaked * pred.oddsAtPlace);
          pred.settledAt = new Date();

          // Credit wallet
          const wallet = wallets.get(userId);
          if (wallet) {
            wallet.coinsBalance += pred.payoutCoins;
            wallet.version++;
            wallet.updatedAt = new Date();

            const userTxns = transactions.get(userId) || [];
            userTxns.push({
              id: uuid(), walletId: wallet.id, type: 'winnings', amount: pred.payoutCoins,
              refType: 'prediction', refId: pred.id, balanceAfter: wallet.coinsBalance,
              description: `🏆 Won: ${pred.selectionLabel} @ ${pred.oddsAtPlace}x — ${pred.matchInfo}`,
              createdAt: new Date(),
            });
            transactions.set(userId, userTxns);
          }

          totalWinners++;
          totalPayouts += pred.payoutCoins;

          // Update leaderboard
          this.updateLeaderboard(userId, true, pred.payoutCoins - pred.coinsStaked);
        } else {
          // Loser
          pred.status = 'lost';
          pred.payoutCoins = 0;
          pred.settledAt = new Date();

          this.updateLeaderboard(userId, false, -pred.coinsStaked);
        }

        totalSettled++;
      }
    }

    // Invalidate caches
    await redis.del(`market:${marketId}`);
    await redis.del(`leaderboard:season:IPL-2026`);

    logger.info(`Market ${marketId} settled`, {
      totalSettled, totalWinners, totalPayouts,
      result, type: market.type,
    });

    this.settledCount += totalSettled;

    return { totalSettled, totalWinners, totalPayouts, result };
  }

  // ── Settle All Markets for a Match ──
  async settleMatch(matchId, results) {
    logger.info(`Settling match ${matchId}`, { marketCount: Object.keys(results).length });
    const settled = [];

    for (const [marketId, result] of Object.entries(results)) {
      try {
        const res = await this.settleMarket(marketId, result);
        settled.push({ marketId, ...res });
      } catch (err) {
        logger.error(`Failed to settle market ${marketId}`, { error: err.message });
        settled.push({ marketId, error: err.message });
      }
    }

    return settled;
  }

  // ── Void a Market (refund all) ──
  async voidMarket(marketId, reason) {
    const market = markets.find(mk => mk.id === marketId);
    if (!market) throw new Error('Market not found');

    market.status = 'voided';
    market.settledAt = new Date();
    let refunded = 0;

    for (const [userId, userPreds] of predictions.entries()) {
      for (const pred of userPreds) {
        if (pred.marketId !== marketId || pred.status !== 'active') continue;

        pred.status = 'void';
        pred.settledAt = new Date();

        const wallet = wallets.get(userId);
        if (wallet) {
          wallet.coinsBalance += pred.coinsStaked;
          wallet.version++;

          const userTxns = transactions.get(userId) || [];
          userTxns.push({
            id: uuid(), walletId: wallet.id, type: 'refund', amount: pred.coinsStaked,
            refType: 'prediction', refId: pred.id, balanceAfter: wallet.coinsBalance,
            description: `↩️ Refund: Market voided — ${reason}`, createdAt: new Date(),
          });
          transactions.set(userId, userTxns);
        }
        refunded++;
      }
    }

    logger.info(`Market ${marketId} voided`, { reason, refundedPredictions: refunded });
    return { refunded, reason };
  }

  // ── Update Leaderboard ──
  updateLeaderboard(userId, won, profitLoss) {
    let entry = leaderboardEntries.find(e => e.userId === userId && e.period === 'season' && e.periodKey === 'IPL-2026');

    if (!entry) {
      entry = {
        id: uuid(), userId, username: 'Unknown',
        period: 'season', periodKey: 'IPL-2026',
        points: 0, predictionsWon: 0, streak: 0, rank: 999,
      };
      leaderboardEntries.push(entry);
    }

    if (won) {
      entry.points += Math.max(10, Math.floor(profitLoss / 10));
      entry.predictionsWon++;
      entry.streak++;
    } else {
      entry.points = Math.max(0, entry.points - 5);
      entry.streak = 0;
    }

    // Re-rank
    leaderboardEntries.sort((a, b) => b.points - a.points);
    leaderboardEntries.forEach((e, i) => e.rank = i + 1);
  }

  // ── Stats ──
  getStats() {
    return { totalSettled: this.settledCount, timestamp: new Date() };
  }
}

export const settlementEngine = new SettlementEngine();
export default settlementEngine;
