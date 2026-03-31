import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { predictionLimiter } from '../middleware/rateLimiter.js';
import { geoBlockMiddleware } from '../middleware/geoBlock.js';
import { predictions, wallets, transactions, markets, matches } from '../data/store.js';
import { PREDICTION_LIMITS } from '../config/constants.js';

const router = Router();
router.use(authMiddleware);

// POST /api/v1/predictions
router.post('/', predictionLimiter, geoBlockMiddleware, (req, res) => {
  const { marketId, selection, coins } = req.body;
  const userId = req.user.id;

  if (!marketId || !selection || !coins) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (coins < PREDICTION_LIMITS.MIN_COINS || coins > PREDICTION_LIMITS.MAX_COINS) {
    return res.status(400).json({ error: 'INVALID_COINS', message: `Coins must be between ${PREDICTION_LIMITS.MIN_COINS} and ${PREDICTION_LIMITS.MAX_COINS}` });
  }

  const market = markets.find(mk => mk.id === marketId);
  if (!market) return res.status(404).json({ error: 'MARKET_NOT_FOUND' });
  if (market.status !== 'open') return res.status(400).json({ error: 'MARKET_CLOSED' });

  const option = market.options.find(o => o.key === selection);
  if (!option) return res.status(400).json({ error: 'INVALID_SELECTION' });

  const wallet = wallets.get(userId);
  if (!wallet || wallet.coinsBalance < coins) return res.status(400).json({ error: 'INSUFFICIENT_COINS' });

  // Check per-match limit
  const userPreds = [...(predictions.get(userId) || [])];
  const matchPreds = userPreds.filter(p => p.matchId === market.matchId && p.status === 'active');
  if (matchPreds.length >= PREDICTION_LIMITS.MAX_PER_MATCH) {
    return res.status(400).json({ error: 'MATCH_LIMIT_REACHED', message: `Max ${PREDICTION_LIMITS.MAX_PER_MATCH} predictions per match` });
  }

  // Debit wallet
  wallet.coinsBalance -= coins;
  wallet.version++;
  wallet.updatedAt = new Date();

  const match = matches.find(m => m.id === market.matchId);

  const prediction = {
    id: uuid(), userId, matchId: market.matchId, marketId, selection,
    selectionLabel: option.label, coinsStaked: coins, oddsAtPlace: option.odds,
    potentialPayout: Math.floor(coins * option.odds),
    status: 'active', payoutCoins: 0, placedAt: new Date(),
    matchInfo: match ? `${match.teamAData?.short || match.teamA} vs ${match.teamBData?.short || match.teamB}` : '',
    marketType: market.type, marketDescription: market.description,
  };

  if (!predictions.has(userId)) predictions.set(userId, []);
  predictions.get(userId).push(prediction);

  const userTxns = transactions.get(userId) || [];
  userTxns.push({ id: uuid(), walletId: wallet.id, type: 'debit', amount: coins, refType: 'prediction', refId: prediction.id, balanceAfter: wallet.coinsBalance, description: `Prediction: ${prediction.matchInfo} — ${option.label}`, createdAt: new Date() });
  transactions.set(userId, userTxns);

  res.status(201).json({ success: true, prediction, newBalance: wallet.coinsBalance });
});

// GET /api/v1/predictions/my
router.get('/my', (req, res) => {
  const { status, matchId } = req.query;
  let userPreds = predictions.get(req.user.id) || [];
  if (status) userPreds = userPreds.filter(p => p.status === status);
  if (matchId) userPreds = userPreds.filter(p => p.matchId === matchId);
  userPreds.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  res.json({ success: true, predictions: userPreds, total: userPreds.length });
});

// GET /api/v1/predictions/:id
router.get('/:id', (req, res) => {
  const userPreds = predictions.get(req.user.id) || [];
  const pred = userPreds.find(p => p.id === req.params.id);
  if (!pred) return res.status(404).json({ error: 'PREDICTION_NOT_FOUND' });
  res.json({ success: true, prediction: pred });
});

export default router;
