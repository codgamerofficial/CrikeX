// ═══════════════════════════════════════════════════════════════
// CrikeX — Admin Panel API Routes (Appwrite + Convex + Nhost)
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import { listUsers, toggleBlockUser } from '../services/appwriteClient.js';
import { upsertMatchToConvex, settleMarketInConvex, convex } from '../services/convexClient.js';
import { getUserBets, getTransactions, getWallet } from '../services/nhostClient.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(authMiddleware);
router.use(adminOnly);

// ── Dashboard Stats ──
router.get('/dashboard', async (req, res) => {
  try {
    // Collect basic cross-service stats
    const users = await listUsers(10, 0); // Need to get total count in prod
    const matches = await convex.query('matches:list');
    
    res.json({
      success: true,
      dashboard: {
        users: { total: users.length, active: users.filter(u => !u.isBlocked).length },
        matches: { total: matches.length, live: matches.filter(m => m.status === 'live').length },
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'DASHBOARD_ERROR', message: err.message });
  }
});

// ── User Management (Appwrite) ──
router.get('/users', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  try {
    const users = await listUsers(Number(limit), offset);
    res.json({ success: true, users, total: users.length });
  } catch (err) {
    res.status(500).json({ error: 'FETCH_USERS_FAILED', message: err.message });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    // Appwrite user info is fetched via Nhost or Appwrite. We just get stats here.
    const wallet = await getWallet(req.params.id);
    const recentBets = await getUserBets(req.params.id, null, 10);
    const recentTxns = await getTransactions(req.params.id, 10, 0);
    
    res.json({ 
      success: true, 
      wallet, 
      recentPredictions: recentBets?.bets || [], 
      recentTransactions: recentTxns?.wallet_transactions || [] 
    });
  } catch (err) {
    res.status(500).json({ error: 'USER_DETAILS_FAILED', message: err.message });
  }
});

router.patch('/users/:id/block', async (req, res) => {
  try {
    const result = await toggleBlockUser(req.params.id);
    logger.audit('user_block_toggle', req.user.id, { targetUser: req.params.id, blocked: result.isBlocked });
    res.json({ success: true, isBlocked: result.isBlocked });
  } catch (err) {
    res.status(500).json({ error: 'BLOCK_FAILED', message: err.message });
  }
});

// ── Match Management (Convex) ──
router.post('/matches', async (req, res) => {
  try {
    const matchId = await upsertMatchToConvex(req.body);
    res.json({ success: true, matchId });
  } catch (err) {
    res.status(500).json({ error: 'MATCH_UPSERT_FAILED', message: err.message });
  }
});

router.post('/markets', async (req, res) => {
  try {
    const marketId = await convex.mutation('betting:upsertMarket', req.body);
    res.json({ success: true, marketId });
  } catch (err) {
    res.status(500).json({ error: 'MARKET_UPSERT_FAILED', message: err.message });
  }
});

// ── Market Settlement (Convex → Nhost) ──
router.post('/markets/:id/settle', async (req, res) => {
  const { result } = req.body;
  if (!result) return res.status(400).json({ error: 'RESULT_REQUIRED' });
  
  try {
    // 1. Settle in Convex (determines winners/losers instantly for UI)
    const settlementData = await settleMarketInConvex(req.params.id, result);
    
    // 2. Settlement webhook or Nhost bulk sync handles the actual money payouts.
    // For now we just return the convex settlement data. 
    // In prod, Convex triggers an HTTP action to call Nhost GraphQL mutations for each winner.
    
    logger.audit('market_settled', req.user.id, { marketId: req.params.id, result });
    res.json({ success: true, settlement: settlementData });
  } catch (err) {
    res.status(400).json({ error: 'SETTLEMENT_FAILED', message: err.message });
  }
});

export default router;
