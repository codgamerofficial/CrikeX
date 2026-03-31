import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { wallets, transactions } from '../data/store.js';
import { WALLET } from '../config/constants.js';

const router = Router();
router.use(authMiddleware);

// GET /api/v1/wallet
router.get('/', (req, res) => {
  const wallet = wallets.get(req.user.id);
  if (!wallet) return res.status(404).json({ error: 'WALLET_NOT_FOUND' });
  res.json({ success: true, wallet: { coinsBalance: wallet.coinsBalance, premiumBalance: wallet.premiumBalance, updatedAt: wallet.updatedAt } });
});

// GET /api/v1/wallet/transactions
router.get('/transactions', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const userTxns = (transactions.get(req.user.id) || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = (page - 1) * limit;
  res.json({ success: true, transactions: userTxns.slice(start, start + limit), total: userTxns.length, page, totalPages: Math.ceil(userTxns.length / limit) });
});

// POST /api/v1/wallet/claim-daily
router.post('/claim-daily', (req, res) => {
  const wallet = wallets.get(req.user.id);
  const userTxns = transactions.get(req.user.id) || [];

  const today = new Date().toDateString();
  const alreadyClaimed = userTxns.some(t => t.refType === 'daily' && new Date(t.createdAt).toDateString() === today);
  if (alreadyClaimed) return res.status(400).json({ error: 'ALREADY_CLAIMED', message: 'Daily bonus already claimed today!' });

  const bonus = WALLET.DAILY_LOGIN_BONUS;
  wallet.coinsBalance += bonus;
  wallet.version++;
  wallet.updatedAt = new Date();

  userTxns.push({ id: uuid(), walletId: wallet.id, type: 'bonus', amount: bonus, refType: 'daily', refId: null, balanceAfter: wallet.coinsBalance, description: 'Daily login bonus 🎁', createdAt: new Date() });
  transactions.set(req.user.id, userTxns);

  res.json({ success: true, bonus, newBalance: wallet.coinsBalance, message: `+${bonus} coins! Come back tomorrow for more.` });
});

export default router;
