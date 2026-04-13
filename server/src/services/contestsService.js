import { v4 as uuid } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Contests Service
 * Manages multi-match contests with leaderboards and prize distributions
 */
export class ContestsService {
  constructor() {
    this.contests = new Map(); // contestId -> contest data
    this.contest_users = new Map(); // contestId -> Set of userIds
    this.contest_leaderboards = new Map(); // contestId -> leaderboard data
  }

  /**
   * Create a new contest
   */
  createContest(contestData) {
    try {
      const {
        name,
        description,
        matches,
        entryFee,
        maxParticipants,
        prizePool,
        startDate,
        endDate,
        createdBy,
      } = contestData;

      // Validate
      if (!name || !matches || matches.length === 0) {
        return {
          success: false,
          error: 'INVALID_DATA',
          message: 'Contest must have name and at least one match',
        };
      }

      if (maxParticipants && maxParticipants < 1) {
        return {
          success: false,
          error: 'INVALID_PARTICIPANTS',
        };
      }

      const contestId = uuid();
      const contest = {
        id: contestId,
        name,
        description,
        matches,
        entryFee: entryFee || 0,
        maxParticipants: maxParticipants || 10000,
        prizePool: prizePool || 0,
        totalEntryFees: 0,
        participantCount: 0,
        status: 'upcoming', // upcoming, live, completed, cancelled
        startDate,
        endDate,
        createdBy,
        createdAt: new Date(),
        winners: [],
      };

      this.contests.set(contestId, contest);
      this.contest_users.set(contestId, new Set());

      logger.info('Contest created', {
        contestId,
        name,
        matchCount: matches.length,
      });

      return {
        success: true,
        contest,
      };
    } catch (error) {
      logger.error('Contest creation failed', { error: error.message });
      return {
        success: false,
        error: 'CREATION_FAILED',
      };
    }
  }

  /**
   * Join contest
   */
  joinContest(contestId, userId, entryFee) {
    try {
      const contest = this.contests.get(contestId);

      if (!contest) {
        return {
          success: false,
          error: 'CONTEST_NOT_FOUND',
        };
      }

      if (contest.status !== 'upcoming') {
        return {
          success: false,
          error: 'CONTEST_NOT_JOINABLE',
          message: `Contest is ${contest.status}`,
        };
      }

      if (contest.participantCount >= contest.maxParticipants) {
        return {
          success: false,
          error: 'CONTEST_FULL',
        };
      }

      if (entryFee !== contest.entryFee) {
        return {
          success: false,
          error: 'INVALID_ENTRY_FEE',
          expectedFee: contest.entryFee,
        };
      }

      const users = this.contest_users.get(contestId);

      if (users.has(userId)) {
        return {
          success: false,
          error: 'ALREADY_JOINED',
          message: 'You have already joined this contest',
        };
      }

      // Add user
      users.add(userId);
      contest.participantCount++;
      contest.totalEntryFees += entryFee;
      contest.prizePool += Math.round(entryFee * 0.9); // 90% to prizes, 10% platform fee

      // Initialize leaderboard entry
      const leaderboard = this.contest_leaderboards.get(contestId) || [];
      leaderboard.push({
        userId,
        rank: contest.participantCount,
        points: 0,
        predictions: [],
        joinedAt: new Date(),
      });
      this.contest_leaderboards.set(contestId, leaderboard);

      logger.info('User joined contest', {
        contestId,
        userId,
        participantCount: contest.participantCount,
      });

      return {
        success: true,
        message: 'Successfully joined contest',
        contest: {
          id: contestId,
          name: contest.name,
          participantCount: contest.participantCount,
          totalPrizePool: contest.prizePool,
        },
      };
    } catch (error) {
      logger.error('Join contest failed', { contestId, userId, error: error.message });
      return {
        success: false,
        error: 'JOIN_FAILED',
      };
    }
  }

  /**
   * Submit prediction for contest
   */
  submitContestPrediction(contestId, userId, prediction) {
    try {
      const contest = this.contests.get(contestId);

      if (!contest) {
        return { success: false, error: 'CONTEST_NOT_FOUND' };
      }

      const users = this.contest_users.get(contestId);
      if (!users.has(userId)) {
        return { success: false, error: 'NOT_JOINED' };
      }

      // Validate prediction match is in contest
      const matchInContest = contest.matches.some(m => m.id === prediction.matchId);
      if (!matchInContest) {
        return { success: false, error: 'INVALID_MATCH' };
      }

      // Build leaderboard entry
      const leaderboard = this.contest_leaderboards.get(contestId) || [];
      const userEntry = leaderboard.find(entry => entry.userId === userId);

      if (!userEntry) {
        return { success: false, error: 'USER_NOT_IN_LEADERBOARD' };
      }

      // Add prediction
      const predictionWithMeta = {
        ...prediction,
        id: uuid(),
        submittedAt: new Date(),
      };

      userEntry.predictions.push(predictionWithMeta);

      return {
        success: true,
        prediction: predictionWithMeta,
      };
    } catch (error) {
      logger.error('Contest prediction submission failed', {
        contestId,
        userId,
        error: error.message,
      });
      return {
        success: false,
        error: 'SUBMISSION_FAILED',
      };
    }
  }

  /**
   * Calculate contest points (called after match settlement)
   */
  updateContestPoints(contestId, matchId, resultData) {
    try {
      const contest = this.contests.get(contestId);
      if (!contest) return { success: false };

      const leaderboard = this.contest_leaderboards.get(contestId) || [];

      leaderboard.forEach(userEntry => {
        const userPredictions = userEntry.predictions.filter(p => p.matchId === matchId);

        userPredictions.forEach(pred => {
          let correctPrediction = false;
          let points = 0;

          // Check if prediction is correct
          if (pred.selection === resultData.winner) {
            correctPrediction = true;
            points = Math.round(pred.odds * 10); // Base points from odds
          }

          // Accuracy bonus
          if (correctPrediction && pred.odds > 2.5) {
            points += 50;
          }

          // Speed bonus (first 100 predictions get bonus)
          const predictionIndex = Math.pow(
            Math.max(0, 100 - userEntry.predictions.indexOf(pred)),
            0.5
          );
          points += Math.round(predictionIndex);

          userEntry.points += points;
          pred.pointsAwarded = points;
          pred.correct = correctPrediction;
        });
      });

      // Sort by points
      leaderboard.sort((a, b) => b.points - a.points);
      leaderboard.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      this.contest_leaderboards.set(contestId, leaderboard);

      logger.info('Contest points updated', { contestId, matchId });

      return {
        success: true,
      };
    } catch (error) {
      logger.error('Contest points update failed', {
        contestId,
        error: error.message,
      });
      return { success: false };
    }
  }

  /**
   * Get contest leaderboard
   */
  getContestLeaderboard(contestId, limit = 100, offset = 0) {
    try {
      const leaderboard = this.contest_leaderboards.get(contestId) || [];

      return {
        success: true,
        leaderboard: leaderboard
          .sort((a, b) => b.points - a.points)
          .slice(offset, offset + limit)
          .map(entry => ({
            rank: entry.rank,
            userId: entry.userId,
            points: entry.points,
            predictions: entry.predictions.length,
            correct: entry.predictions.filter(p => p.correct).length,
            joinedAt: entry.joinedAt,
          })),
        total: leaderboard.length,
      };
    } catch (error) {
      return { success: false, error: 'FETCH_FAILED' };
    }
  }

  /**
   * Distribute prizes
   */
  distributeContestPrizes(contestId) {
    try {
      const contest = this.contests.get(contestId);
      if (!contest) return { success: false, error: 'CONTEST_NOT_FOUND' };

      const leaderboard = this.contest_leaderboards.get(contestId) || [];

      // Prize distribution (top 10%)
      const prizeCount = Math.max(1, Math.ceil(contest.participantCount * 0.1));
      const prizeDistribution = this.calculatePrizeDistribution(
        contest.prizePool,
        prizeCount
      );

      const winners = [];

      for (let i = 0; i < Math.min(prizeCount, leaderboard.length); i++) {
        const userEntry = leaderboard[i];
        const prize = prizeDistribution[i];

        winners.push({
          rank: i + 1,
          userId: userEntry.userId,
          points: userEntry.points,
          prize,
          prizeType: 'coins',
          claimedAt: null,
        });
      }

      contest.winners = winners;
      contest.status = 'completed';

      logger.info('Contest prizes distributed', {
        contestId,
        winners: winners.length,
        totalPrizePool: contest.prizePool,
      });

      return {
        success: true,
        winners,
        totalDistributed: winners.reduce((sum, w) => sum + w.prize, 0),
      };
    } catch (error) {
      logger.error('Prize distribution failed', {
        contestId,
        error: error.message,
      });
      return { success: false, error: 'DISTRIBUTION_FAILED' };
    }
  }

  /**
   * Calculate prize distribution
   * Uses top-heavy distribution (winner gets 40%, 2nd gets 25%, etc.)
   */
  calculatePrizeDistribution(totalPrize, prizeCount) {
    const prizes = [];
    const distribution = [0.4, 0.25, 0.15, 0.1, 0.05, 0.03, 0.01, 0.005];

    let remaining = totalPrize;

    for (let i = 0; i < prizeCount; i++) {
      const percentage = distribution[i] || 0.001;
      const prize = Math.round(totalPrize * percentage);
      prizes.push(Math.min(prize, remaining));
      remaining -= prizes[i];
    }

    // Add any remaining to last prize
    if (remaining > 0) {
      prizes[prizes.length - 1] += remaining;
    }

    return prizes;
  }

  /**
   * Claim prize
   */
  claimContestPrize(contestId, userId) {
    try {
      const contest = this.contests.get(contestId);
      if (!contest) return { success: false, error: 'CONTEST_NOT_FOUND' };

      const winner = contest.winners.find(w => w.userId === userId);
      if (!winner) return { success: false, error: 'NOT_IN_WINNERS' };

      if (winner.claimedAt) {
        return { success: false, error: 'ALREADY_CLAIMED' };
      }

      winner.claimedAt = new Date();

      logger.info('Contest prize claimed', {
        contestId,
        userId,
        prize: winner.prize,
        rank: winner.rank,
      });

      return {
        success: true,
        prize: winner.prize,
        message: `Congrats! You won ₹${winner.prize} coins!`,
      };
    } catch (error) {
      logger.error('Prize claim failed', { contestId, userId, error: error.message });
      return { success: false, error: 'CLAIM_FAILED' };
    }
  }

  /**
   * Get user's contest summary
   */
  getUserContestSummary(userId) {
    try {
      const contestsSummary = [];

      for (const [contestId, contest] of this.contests.entries()) {
        const users = this.contest_users.get(contestId);

        if (!users.has(userId)) continue;

        const leaderboard = this.contest_leaderboards.get(contestId) || [];
        const userEntry = leaderboard.find(e => e.userId === userId);
        const winner = contest.winners.find(w => w.userId === userId);

        contestsSummary.push({
          contestId,
          name: contest.name,
          status: contest.status,
          participantCount: contest.participantCount,
          rank: userEntry?.rank,
          points: userEntry?.points,
          predictions: userEntry?.predictions.length,
          prizeWon: winner?.prize || null,
          prizeStatus: winner?.claimedAt ? 'claimed' : winner ? 'won' : 'not_won',
          entryFee: contest.entryFee,
          endDate: contest.endDate,
        });
      }

      return {
        success: true,
        contests: contestsSummary,
      };
    } catch (error) {
      logger.error('Contest summary fetch failed', { userId, error: error.message });
      return { success: false, error: 'FETCH_FAILED' };
    }
  }

  /**
   * Get active contests
   */
  getActiveContests() {
    try {
      const active = Array.from(this.contests.values())
        .filter(c => ['upcoming', 'live'].includes(c.status))
        .map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          status: c.status,
          matchCount: c.matches.length,
          participantCount: c.participantCount,
          maxParticipants: c.maxParticipants,
          entryFee: c.entryFee,
          totalPrizePool: c.prizePool,
          startDate: c.startDate,
          endDate: c.endDate,
          isFull: c.participantCount >= c.maxParticipants,
        }))
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

      return {
        success: true,
        contests: active,
        total: active.length,
      };
    } catch (error) {
      return { success: false, error: 'FETCH_FAILED' };
    }
  }
}

export const contestsService = new ContestsService();
