import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { analyticsService } from '../services/analyticsService.js';
import { contestsService } from '../services/contestsService.js';
import { isFeatureEnabled } from '../middleware/featureFlags.js';
import logger from '../utils/logger.js';

const router = Router();

// ── ANALYTICS ROUTES ──

/**
 * GET /api/v1/analytics/user-stats
 * Get user's prediction statistics
 */
router.get('/user-stats', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('ANALYTICS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    // In production, fetch from database
    const mockPredictions = [
      { status: 'won', stake: 500, payout: 1500, odds: 2.5, createdAt: new Date() },
      { status: 'lost', stake: 300, odds: 1.8 },
      { status: 'won', stake: 700, payout: 2100, odds: 2.0 },
    ];

    const stats = analyticsService.calculateUserStats(req.user.id, mockPredictions);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Analytics fetch failed', { userId: req.user.id, error: error.message });
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /api/v1/analytics/performance-trend
 * Get user's performance over time
 */
router.get('/performance-trend', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('ANALYTICS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const daysBack = parseInt(req.query.days) || 30;

    // In production, fetch from database
    const mockPredictions = [];

    const trend = analyticsService.getPerformanceTrend(
      req.user.id,
      mockPredictions,
      daysBack
    );

    res.json({
      success: true,
      trend,
      daysBack,
    });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /api/v1/analytics/match/:matchId
 * Get analytics for a specific match
 */
router.get('/match/:matchId', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('ANALYTICS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const { matchId } = req.params;

    const analytics = analyticsService.getMatchAnalytics(matchId, []);

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /api/v1/analytics/recommendations
 * Get personalized recommendations based on performance
 */
router.get('/recommendations', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('ANALYTICS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const stats = analyticsService.userStats.get(req.user.id) || {};
    const recommendations = analyticsService.getRecommendations(req.user.id, stats);

    res.json({
      success: true,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /api/v1/analytics/comparison
 * Compare user performance with others (percentile)
 */
router.get('/comparison', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('ANALYTICS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const userStats = analyticsService.userStats.get(req.user.id);
    if (!userStats) {
      return res.status(404).json({ error: 'NO_STATS' });
    }

    const allStats = Array.from(analyticsService.userStats.values());
    const comparison = analyticsService.getUserComparison(userStats, allStats);

    res.json({
      success: true,
      comparison,
    });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /api/v1/analytics/export
 * Export user's analytics data
 */
router.get('/export', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('ANALYTICS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const result = analyticsService.exportUserData(req.user.id);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    // Return as downloadable JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="crikex-analytics-${new Date().toISOString()}.json"`);
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: 'EXPORT_FAILED' });
  }
});

// ── CONTESTS ROUTES ──

/**
 * POST /api/v1/contests/create
 * Create a new contest
 */
router.post('/create', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('CONTESTS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const result = contestsService.createContest({
      ...req.body,
      createdBy: req.user.id,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error, message: result.message });
    }

    res.status(201).json({
      success: true,
      contest: result.contest,
    });
  } catch (error) {
    logger.error('Contest creation failed', { error: error.message });
    res.status(500).json({ error: 'CREATION_FAILED' });
  }
});

/**
 * GET /api/v1/contests/active
 * Get all active contests
 */
router.get('/active', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('CONTESTS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const result = contestsService.getActiveContests();

    res.json({
      success: true,
      contests: result.contests,
      total: result.total,
    });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * POST /api/v1/contests/:contestId/join
 * Join a contest
 */
router.post('/:contestId/join', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('CONTESTS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const { contestId } = req.params;
    const { entryFee } = req.body;

    const result = contestsService.joinContest(contestId, req.user.id, entryFee);

    if (!result.success) {
      return res.status(400).json({ error: result.error, message: result.message });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'JOIN_FAILED' });
  }
});

/**
 * POST /api/v1/contests/:contestId/predict
 * Submit prediction for contest
 */
router.post('/:contestId/predict', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('CONTESTS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const { contestId } = req.params;
    const prediction = req.body;

    const result = contestsService.submitContestPrediction(
      contestId,
      req.user.id,
      prediction
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'SUBMISSION_FAILED' });
  }
});

/**
 * GET /api/v1/contests/:contestId/leaderboard
 * Get contest leaderboard
 */
router.get('/:contestId/leaderboard', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('CONTESTS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const { contestId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = contestsService.getContestLeaderboard(contestId, limit, offset);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * GET /api/v1/contests/my-contests
 * Get user's contest summary
 */
router.get('/my-contests', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('CONTESTS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const result = contestsService.getUserContestSummary(req.user.id);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

/**
 * POST /api/v1/contests/:contestId/claim-prize
 * Claim contest prize
 */
router.post('/:contestId/claim-prize', authMiddleware, (req, res) => {
  try {
    if (!isFeatureEnabled('CONTESTS', req.user.id)) {
      return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
    }

    const { contestId } = req.params;

    const result = contestsService.claimContestPrize(contestId, req.user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'CLAIM_FAILED' });
  }
});

export default router;
