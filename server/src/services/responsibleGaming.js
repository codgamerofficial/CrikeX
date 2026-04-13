import logger from '../utils/logger.js';

/**
 * Responsible Gaming Service
 * Implements betting limits, self-exclusion, reality check reminders
 */
export class ResponsibleGamingService {
  constructor() {
    this.userLimits = new Map(); // userId -> { daily, weekly, monthly }
    this.userSessions = new Map(); // userId -> { startTime, totalBetted, betsPlaced }
    this.selfExcluded = new Map(); // userId -> { excludedUntil, reason }
  }

  /**
   * Set betting limits for user
   */
  setLimits(userId, limits) {
    const { daily = 10000, weekly = 50000, monthly = 200000 } = limits;

    this.userLimits.set(userId, {
      daily,
      weekly,
      monthly,
      setAt: new Date(),
    });

    logger.info('Responsible gaming limits set', { userId, daily, weekly, monthly });

    return {
      success: true,
      limits: { daily, weekly, monthly },
    };
  }

  /**
   * Get user's current limits
   */
  getLimits(userId) {
    return this.userLimits.get(userId) || {
      daily: 10000,
      weekly: 50000,
      monthly: 200000,
    };
  }

  /**
   * Check if user can place a bet given the amount
   */
  canPlaceBet(userId, amount, userBets = []) {
    // Check self-exclusion
    const excluded = this.selfExcluded.get(userId);
    if (excluded && excluded.excludedUntil > new Date()) {
      return {
        allowed: false,
        reason: 'SELF_EXCLUDED',
        message: `Your account is self-excluded until ${excluded.excludedUntil.toDateString()}`,
      };
    }

    // Get limits
    const limits = this.getLimits(userId);

    // Calculate today's total
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyTotal = userBets
      .filter(bet => {
        const betDate = new Date(bet.createdAt);
        betDate.setHours(0, 0, 0, 0);
        return betDate.getTime() === today.getTime();
      })
      .reduce((sum, bet) => sum + bet.stake, 0);

    if (dailyTotal + amount > limits.daily) {
      return {
        allowed: false,
        reason: 'DAILY_LIMIT_EXCEEDED',
        message: `Daily limit (₹${limits.daily}) exceeded. Already wagered: ₹${dailyTotal}`,
        currentDaily: dailyTotal,
        dailyLimit: limits.daily,
        remainingDaily: Math.max(0, limits.daily - dailyTotal),
      };
    }

    // Calculate weekly total
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const weeklyTotal = userBets
      .filter(bet => new Date(bet.createdAt) >= thisWeekStart)
      .reduce((sum, bet) => sum + bet.stake, 0);

    if (weeklyTotal + amount > limits.weekly) {
      return {
        allowed: false,
        reason: 'WEEKLY_LIMIT_EXCEEDED',
        message: `Weekly limit (₹${limits.weekly}) exceeded. Already wagered: ₹${weeklyTotal}`,
      };
    }

    // Calculate monthly total
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const monthlyTotal = userBets
      .filter(bet => new Date(bet.createdAt) >= thisMonthStart)
      .reduce((sum, bet) => sum + bet.stake, 0);

    if (monthlyTotal + amount > limits.monthly) {
      return {
        allowed: false,
        reason: 'MONTHLY_LIMIT_EXCEEDED',
        message: `Monthly limit (₹${limits.monthly}) exceeded. Already wagered: ₹${monthlyTotal}`,
      };
    }

    // All checks passed
    return {
      allowed: true,
      remainingDaily: limits.daily - dailyTotal,
      remainingWeekly: limits.weekly - weeklyTotal,
      remainingMonthly: limits.monthly - monthlyTotal,
    };
  }

  /**
   * Self-exclude user account
   */
  selfExclude(userId, duration = 30) {
    const excludedUntil = new Date();
    excludedUntil.setDate(excludedUntil.getDate() + duration);

    this.selfExcluded.set(userId, {
      excludedUntil,
      reason: 'USER_REQUESTED',
      createdAt: new Date(),
    });

    logger.warn('User self-excluded', {
      userId,
      duration,
      until: excludedUntil,
    });

    return {
      success: true,
      message: `Account self-excluded for ${duration} days`,
      excludedUntil,
    };
  }

  /**
   * Lift self-exclusion (admin only)
   */
  liftSelfExclusion(userId) {
    const wasExcluded = this.selfExcluded.has(userId);
    this.selfExcluded.delete(userId);

    if (wasExcluded) {
      logger.info('Self-exclusion lifted', { userId });
    }

    return {
      success: true,
      message: 'Self-exclusion removed',
    };
  }

  /**
   * Check if user needs reality check reminder
   * Show reminder every 30 minutes during session
   */
  needsRealityCheckReminder(userId, sessionDuration = 0) {
    // Remind every 30 minutes (1800 seconds)
    return sessionDuration > 0 && sessionDuration % 1800 < 60;
  }

  /**
   * Get reality check messages
   */
  getRealityCheckMessage() {
    const messages = [
      'You have been playing for a while. Take a break and assess your bets.',
      'Remember, CrikeX is for entertainment. Only bet what you can afford to lose.',
      'Did you know? Over 95% of successful players set daily limits.',
      'Time for a break! You can resume your predictions anytime.',
      'Responsible gaming means knowing when to stop.',
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Get betting insights
   */
  getBettingInsights(userId, userBets = []) {
    const totalBets = userBets.length;
    const totalWagered = userBets.reduce((sum, bet) => sum + bet.stake, 0);
    const totalWon = userBets.filter(bet => bet.status === 'won').length;

    const winRate = totalBets > 0 ? ((totalWon / totalBets) * 100).toFixed(2) : 0;
    const avgBetSize = totalBets > 0 ? Math.round(totalWagered / totalBets) : 0;

    return {
      totalBets,
      totalWagered,
      totalWon,
      winRate: `${winRate}%`,
      avgBetSize,
      insights: [
        winRate > 70
          ? '⚠️ Your win rate is very high. Ensure bets are based on skill, not luck.'
          : '💡 Keep improving your analysis skills.',
        totalWagered > 100000
          ? '💰 High wagering detected. Consider setting tighter limits.'
          : '✓ Your wagering is within healthy limits.',
      ],
    };
  }

  /**
   * Generate responsible gaming report
   */
  getResponsibleGamingReport(userId, userBets = []) {
    const limits = this.getLimits(userId);
    const insights = this.getBettingInsights(userId, userBets);
    const excluded = this.selfExcluded.get(userId);

    return {
      limits,
      insights,
      selfExcluded: !!excluded,
      selfExcludedUntil: excluded?.excludedUntil || null,
      recommendations: [
        'Set realistic betting limits based on your bankroll',
        'Never chase losses - accept defeats and move on',
        'Take regular breaks from betting',
        'Only bet with disposable income',
        'Track your betting patterns and results',
      ],
    };
  }
}

export const responsibleGamingService = new ResponsibleGamingService();
