import logger from '../utils/logger.js';

/**
 * Analytics Service
 * Tracks user predictions, performance, and trends
 */
export class AnalyticsService {
  constructor() {
    this.userStats = new Map(); // userId -> { predictions, winRate, profit, streak, ... }
    this.matchAnalytics = new Map(); // matchId -> { totalBets, volume, ... }
  }

  /**
   * Calculate user statistics
   */
  calculateUserStats(userId, predictions = []) {
    const totalBets = predictions.length;
    const won = predictions.filter(p => p.status === 'won').length;
    const lost = predictions.filter(p => p.status === 'lost').length;
    const active = predictions.filter(p => p.status === 'active').length;

    const winRate = totalBets > 0 ? ((won / totalBets) * 100).toFixed(2) : 0;

    const totalStaked = predictions.reduce((sum, p) => sum + (p.stake || 0), 0);
    const totalWinnings = predictions
      .filter(p => p.status === 'won')
      .reduce((sum, p) => sum + (p.payout || 0), 0);

    const profit = totalWinnings - totalStaked;
    const roi = totalStaked > 0 ? ((profit / totalStaked) * 100).toFixed(2) : 0;

    // Calculate win streak
    let streak = 0;
    let maxStreak = 0;
    for (const pred of [...predictions].reverse()) {
      if (pred.status === 'won') {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else if (pred.status === 'lost') {
        streak = 0;
      }
    }

    // Highest odds prediction
    const maxOdds = Math.max(...predictions.map(p => p.odds || 0));
    const maxOddsPrediction = predictions.find(p => p.odds === maxOdds);

    // Favorite market
    const marketFrequency = {};
    predictions.forEach(p => {
      marketFrequency[p.marketId] = (marketFrequency[p.marketId] || 0) + 1;
    });
    const favoriteMarket = Object.keys(marketFrequency).reduce((a, b) =>
      marketFrequency[a] > marketFrequency[b] ? a : b
    );

    // Favorite selection
    const selectionFrequency = {};
    predictions.forEach(p => {
      selectionFrequency[p.selection] = (selectionFrequency[p.selection] || 0) + 1;
    });
    const favoriteSelection = Object.keys(selectionFrequency).reduce((a, b) =>
      selectionFrequency[a] > selectionFrequency[b] ? a : b
    );

    const stats = {
      userId,
      totalBets,
      totalStaked,
      totalWinnings,
      profit,
      winRate: parseFloat(winRate),
      roi: parseFloat(roi),
      won,
      lost,
      active,
      streak,
      maxStreak,
      maxOddsPrediction,
      favoriteMarket,
      favoriteSelection,
      avgStake: totalBets > 0 ? (totalStaked / totalBets).toFixed(2) : 0,
      avgOdds: totalBets > 0
        ? (predictions.reduce((sum, p) => sum + (p.odds || 0), 0) / totalBets).toFixed(2)
        : 0,
      lastPredictionAt: predictions[0]?.createdAt || null,
      firstPredictionAt: predictions[predictions.length - 1]?.createdAt || null,
    };

    this.userStats.set(userId, stats);
    return stats;
  }

  /**
   * Get performance over time
   */
  getPerformanceTrend(userId, predictions = [], daysBack = 30) {
    const now = new Date();
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const dailyStats = {};

    predictions
      .filter(p => new Date(p.createdAt) >= startDate)
      .forEach(p => {
        const date = new Date(p.createdAt).toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            bets: 0,
            won: 0,
            lost: 0,
            staked: 0,
            winnings: 0,
          };
        }

        dailyStats[date].bets++;
        dailyStats[date].staked += p.stake || 0;

        if (p.status === 'won') {
          dailyStats[date].won++;
          dailyStats[date].winnings += p.payout || 0;
        } else if (p.status === 'lost') {
          dailyStats[date].lost++;
        }
      });

    return Object.values(dailyStats)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(day => ({
        ...day,
        winRate: day.bets > 0 ? ((day.won / day.bets) * 100).toFixed(2) : 0,
        profit: day.winnings - day.staked,
      }));
  }

  /**
   * Get match analytics
   */
  getMatchAnalytics(matchId, bets = []) {
    const totalBets = bets.length;
    const totalVolume = bets.reduce((sum, b) => sum + (b.stake || 0), 0);

    // Bet distribution by selection
    const selectionBreakdown = {};
    bets.forEach(b => {
      if (!selectionBreakdown[b.selection]) {
        selectionBreakdown[b.selection] = {
          selection: b.selection,
          count: 0,
          volume: 0,
          percentage: 0,
        };
      }
      selectionBreakdown[b.selection].count++;
      selectionBreakdown[b.selection].volume += b.stake || 0;
    });

    // Calculate percentages
    Object.values(selectionBreakdown).forEach(sel => {
      sel.percentage = totalVolume > 0 ? ((sel.volume / totalVolume) * 100).toFixed(2) : 0;
    });

    // Odds movement
    const oddsHistory = [...new Set(bets.map(b => b.odds))].sort((a, b) => a - b);
    const oddsMove = oddsHistory.length > 1
      ? ((oddsHistory[oddsHistory.length - 1] - oddsHistory[0]).toFixed(3))
      : 0;

    const analytics = {
      matchId,
      totalBets,
      totalVolume,
      avgStakePerBet: totalBets > 0 ? (totalVolume / totalBets).toFixed(2) : 0,
      selectionBreakdown: Object.values(selectionBreakdown),
      oddsMovement: parseFloat(oddsMove),
      oddsRange: {
        min: Math.min(...bets.map(b => b.odds || 0)),
        max: Math.max(...bets.map(b => b.odds || 0)),
      },
      peakBettingTime: this.getPeakBettingTime(bets),
    };

    this.matchAnalytics.set(matchId, analytics);
    return analytics;
  }

  /**
   * Get peak betting time
   */
  getPeakBettingTime(bets) {
    const hourlyBets = {};

    bets.forEach(b => {
      const hour = new Date(b.createdAt).getHours();
      hourlyBets[hour] = (hourlyBets[hour] || 0) + 1;
    });

    return Object.entries(hourlyBets)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;
  }

  /**
   * Get prediction recommendations
   */
  getRecommendations(userId, stats, matches = []) {
    const recommendations = [];

    // Recommendation 1: Favorite market
    if (stats.favoriteMarket) {
      recommendations.push({
        type: 'favorite_market',
        title: 'You excel at Match Winner predictions',
        description: `Your ${stats.favoriteMarket} win rate is ${stats.winRate}%`,
        action: 'Focus on your strongest market',
        priority: 'high',
      });
    }

    // Recommendation 2: Improve low-performing markets
    if (stats.winRate < 45) {
      recommendations.push({
        type: 'skill_development',
        title: 'Improve your prediction skills',
        description: 'Your current win rate is below average',
        action: 'Study more match data before placing predictions',
        priority: 'high',
      });
    }

    // Recommendation 3: Manage bankroll
    if (stats.roi < 0) {
      recommendations.push({
        type: 'bankroll_management',
        title: 'Review betting strategy',
        description: 'Your ROI is negative',
        action: 'Consider reducing bet sizes or increasing analysis time',
        priority: 'medium',
      });
    }

    // Recommendation 4: Win streak
    if (stats.streak >= 5) {
      recommendations.push({
        type: 'momentum',
        title: `You\'re on a ${stats.streak}-bet winning streak!`,
        description: 'Great predictions recently',
        action: 'Maintain your current strategy',
        priority: 'low',
      });
    }

    // Recommendation 5: Upcoming matches
    if (matches.length > 0) {
      recommendations.push({
        type: 'upcoming_match',
        title: 'New matches available',
        description: `${matches.length} new matches to predict on`,
        action: 'Check out the latest matches',
        priority: 'medium',
        matches: matches.slice(0, 3),
      });
    }

    return recommendations;
  }

  /**
   * Get comparison vs other users (leaderboard percentile)
   */
  getUserComparison(userStats, allUserStats = []) {
    const userWinRates = allUserStats.map(s => parseFloat(s.winRate));
    const userROIs = allUserStats.map(s => parseFloat(s.roi));
    const userProfit = allUserStats.map(s => s.profit);

    const winRatePercentile = this.getPercentile(userStats.winRate, userWinRates);
    const roiPercentile = this.getPercentile(userStats.roi, userROIs);
    const profitPercentile = this.getPercentile(userStats.profit, userProfit);

    return {
      winRatePercentile: Math.round(winRatePercentile),
      roiPercentile: Math.round(roiPercentile),
      profitPercentile: Math.round(profitPercentile),
      averageWinRate: (userWinRates.reduce((a, b) => a + b, 0) / userWinRates.length).toFixed(2),
      averageROI: (userROIs.reduce((a, b) => a + b, 0) / userROIs.length).toFixed(2),
      rank: 'Top ' + Math.round(winRatePercentile) + '%',
    };
  }

  /**
   * Calculate percentile
   */
  getPercentile(value, array) {
    const sorted = array.sort((a, b) => a - b);
    const index = sorted.findIndex(v => v >= value);
    return index >= 0 ? ((index / sorted.length) * 100) : 100;
  }

  /**
   * Export user analytics data
   */
  exportUserData(userId) {
    const stats = this.userStats.get(userId);

    if (!stats) {
      return {
        success: false,
        error: 'No analytics data found',
      };
    }

    logger.info('User data exported', { userId });

    return {
      success: true,
      data: {
        stats,
        exportDate: new Date().toISOString(),
        format: 'JSON',
      },
    };
  }
}

export const analyticsService = new AnalyticsService();
