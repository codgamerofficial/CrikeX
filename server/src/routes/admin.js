// ═══════════════════════════════════════════════════════════════
// CrikeX — Admin Panel API Routes
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { users, wallets, predictions, matches, markets, transactions, leaderboardEntries } from '../data/store.js';
import { settlementEngine } from '../services/settlementEngine.js';
import { oddsEngine } from '../services/oddsEngine.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

// ── Dashboard Stats ──
router.get('/dashboard', (req, res) => {
  const totalUsers = users.size;
  const totalPredictions = [...predictions.values()].reduce((acc, arr) => acc + arr.length, 0);
  const totalCoins = [...wallets.values()].reduce((acc, w) => acc + w.coinsBalance, 0);
  const liveMatches = matches.filter(m => m.status === 'live').length;
  const activeMarkets = markets.filter(m => m.status === 'open').length;

  const allPreds = [...predictions.values()].flat();
  const activePreds = allPreds.filter(p => p.status === 'active').length;
  const wonPreds = allPreds.filter(p => p.status === 'won').length;
  const totalStaked = allPreds.reduce((acc, p) => acc + p.coinsStaked, 0);

  res.json({
    success: true,
    dashboard: {
      users: { total: totalUsers, active: totalUsers },
      predictions: { total: totalPredictions, active: activePreds, won: wonPreds, totalStaked },
      matches: { total: matches.length, live: liveMatches },
      markets: { total: markets.length, active: activeMarkets },
      economy: { totalCoinsCirculating: totalCoins },
      settlement: settlementEngine.getStats(),
    },
  });
});

// ── User Management ──
router.get('/users', (req, res) => {
  const { page = 1, limit = 20, search, status } = req.query;
  let userList = [...users.values()];
  if (search) userList = userList.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search));
  if (status) userList = userList.filter(u => u.kycStatus === status);
  const start = (parseInt(page) - 1) * parseInt(limit);
  res.json({ success: true, users: userList.slice(start, start + parseInt(limit)), total: userList.length });
});

router.get('/users/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  const wallet = wallets.get(user.id);
  const userPreds = predictions.get(user.id) || [];
  const userTxns = (transactions.get(user.id) || []).slice(0, 20);
  res.json({ success: true, user, wallet, recentPredictions: userPreds.slice(-10), recentTransactions: userTxns });
});

router.patch('/users/:id/block', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  user.isBlocked = !user.isBlocked;
  user.blockReason = req.body.reason || null;
  logger.audit('user_block_toggle', req.user.id, { targetUser: user.id, blocked: user.isBlocked, reason: user.blockReason });
  res.json({ success: true, user });
});

// ── Match Management ──
router.get('/matches', (req, res) => {
  res.json({ success: true, matches, total: matches.length });
});

router.patch('/matches/:id/status', (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  const { status } = req.body;
  if (!['upcoming', 'live', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });
  match.status = status;
  logger.audit('match_status_change', req.user.id, { matchId: match.id, newStatus: status });
  res.json({ success: true, match });
});

// ── Market Settlement ──
router.post('/markets/:id/settle', (req, res) => {
  const { result } = req.body;
  if (!result) return res.status(400).json({ error: 'RESULT_REQUIRED' });
  try {
    const settlement = settlementEngine.settleMarket(req.params.id, result);
    logger.audit('market_settled', req.user.id, { marketId: req.params.id, result });
    res.json({ success: true, ...settlement });
  } catch (err) {
    res.status(400).json({ error: 'SETTLEMENT_FAILED', message: err.message });
  }
});

router.post('/markets/:id/void', (req, res) => {
  const { reason } = req.body;
  try {
    const result = settlementEngine.voidMarket(req.params.id, reason || 'Admin decision');
    logger.audit('market_voided', req.user.id, { marketId: req.params.id, reason });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: 'VOID_FAILED', message: err.message });
  }
});

// ── AI Predictions ──
router.get('/ai/predict/:matchId', (req, res) => {
  const match = matches.find(m => m.id === req.params.matchId);
  if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  const prediction = oddsEngine.predictMatchOutcome(match.teamA, match.teamB, match.venue);
  res.json({ success: true, prediction });
});

// ── Leaderboard Management ──
router.get('/leaderboard/stats', (req, res) => {
  res.json({ success: true, entries: leaderboardEntries.length, topUser: leaderboardEntries[0] || null });
});

// ── Platform Settings ──
router.get('/settings', (req, res) => {
  res.json({ success: true, settings: { maxPredictionCoins: 5000, minPredictionCoins: 10, dailyBonus: 500, signupBonus: 10000 } });
});

export default router;
