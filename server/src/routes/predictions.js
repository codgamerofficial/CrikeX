import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { predictionLimiter } from '../middleware/rateLimiter.js';
import { geoBlockMiddleware } from '../middleware/geoBlock.js';
import { PREDICTION_LIMITS } from '../config/constants.js';
import { getUserBets, placeBet } from '../services/nhostClient.js';
import { convex } from '../services/convexClient.js';
import { fraudService } from '../services/fraudDetection.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(authMiddleware);

// POST /api/v1/predictions
// Coordinates atomic bet placement between Nhost (Wallet) and Convex (Odds)
router.post('/', predictionLimiter, geoBlockMiddleware, async (req, res) => {
  const { matchId, marketId, marketTitle, selection, coins } = req.body;
  const userId = req.user.id; // From Appwrite/JWT

  if (!matchId || !marketId || !selection || !coins) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }
  if (coins < PREDICTION_LIMITS.MIN_COINS || coins > PREDICTION_LIMITS.MAX_COINS) {
    return res.status(400).json({ error: 'INVALID_COINS', message: `Coins must be between ${PREDICTION_LIMITS.MIN_COINS} and ${PREDICTION_LIMITS.MAX_COINS}` });
  }

  try {
    // 1. Run fraud detection before placing bet
    const fraudResult = await fraudService.analyzePrediction(userId, {
      type: 'prediction_placement',
      amount: coins,
      timestamp: new Date(),
    });

    logger.debug('Fraud detection result', { userId, action: fraudResult.decision });

    if (fraudResult.decision === 'block') {
      // Block user account
      logger.warn('User blocked due to fraud', { userId, reason: fraudResult.risks[0]?.type || "fraud_detected" });
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message: 'Your account has been restricted due to suspicious activity. Please contact support.',
        fraudFlag: fraudResult.risks[0]?.type || "fraud_detected",
      });
    }

    if (fraudResult.decision === 'flag_and_limit') {
      // Reduce max bet for flagged users
      logger.warn('User flagged for fraud', { userId, reason: fraudResult.risks[0]?.type || "fraud_detected" });
      if (coins > 1000) {
        return res.status(400).json({
          error: 'BET_AMOUNT_REDUCED',
          message: 'Your bet amount exceeds the current limit due to account review. Maximum ₹100 per bet.',
          maxBet: 100,
        });
      }
    }

    if (fraudResult.decision === 'flag') {
      // Log for review but allow
      logger.info('User flagged for review', { userId, reason: fraudResult.risks[0]?.type || "fraud_detected" });
    }

    // 2. Register bet in Convex (reserves stake, recalculates odds)
    // Convex ensures market is open and selection is valid
    const convexResponse = await convex.mutation('betting:placeBet', {
      userId,
      matchId,
      marketId,
      selection,
      coinsStaked: coins,
    });

    const { betId: convexBetId, oddsAtPlacement, newOdds } = convexResponse;

    // 3. Persist bet and deduct wallet in Nhost (Atomic Postgres Function)
    const nhostBetId = await placeBet({
      userId,
      matchId,
      marketId,
      marketTitle: marketTitle || marketId,
      selection,
      odds: oddsAtPlacement,
      stake: coins,
      convexBetId,
    });

    logger.info('Prediction placed successfully', {
      userId,
      betId: nhostBetId.place_bet,
      matchId,
      amount: coins,
    });

    res.status(201).json({
      success: true,
      prediction: {
        id: nhostBetId.place_bet,
        convexBetId,
        matchId,
        marketId,
        selection,
        oddsAtPlace: oddsAtPlacement,
        coinsStaked: coins,
        status: 'active',
      },
      newOdds,
    });
  } catch (error) {
    logger.error('Bet placement error', { userId, error: error.message });

    // Handle Convex or Nhost errors
    if (error.message.includes('INSUFFICIENT_BALANCE')) {
      return res.status(400).json({ error: 'INSUFFICIENT_COINS', message: 'Not enough coins in wallet.' });
    }
    if (error.message.includes('MARKET_CLOSED')) {
      return res.status(400).json({ error: 'MARKET_CLOSED', message: 'Market is no longer open for betting.' });
    }

    res.status(500).json({ error: 'BET_PLACEMENT_FAILED', message: error.message });
  }
});

// GET /api/v1/predictions/my
router.get('/my', async (req, res) => {
  const { status, limit = 20 } = req.query;
  
  try {
    const data = await getUserBets(req.user.id, status, Math.min(Number(limit), 50));
    res.json({ 
      success: true, 
      predictions: data.bets,
      total: data.bets_aggregate.aggregate.count,
      stats: data.bets_aggregate.aggregate.sum 
    });
  } catch (error) {
    res.status(500).json({ error: 'DB_ERROR', message: error.message });
  }
});

export default router;
