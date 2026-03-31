// ═══════════════════════════════════════════════════════════════
// CrikeX — Referral System Routes
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { users, wallets, transactions } from '../data/store.js';
import { WALLET } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = Router();
const referrals = new Map(); // referralCode -> { referrerId, referrals: [] }

// Generate unique referral code
function generateReferralCode(username) {
  const base = username.slice(0, 4).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

// Initialize referral codes for existing users
for (const [id, user] of users.entries()) {
  const code = generateReferralCode(user.username);
  user.referralCode = code;
  referrals.set(code, { referrerId: id, referredUsers: [], totalEarned: 0 });
}

// ── Get My Referral Info ──
router.get('/my', authMiddleware, (req, res) => {
  const user = req.user;
  const code = user.referralCode;
  const data = referrals.get(code) || { referrerId: user.id, referredUsers: [], totalEarned: 0 };

  res.json({
    success: true,
    referral: {
      code,
      link: `https://crikex.in/join/${code}`,
      referredCount: data.referredUsers.length,
      totalEarned: data.totalEarned,
      referredUsers: data.referredUsers.map(r => ({
        username: r.username, joinedAt: r.joinedAt, bonusEarned: r.bonusGiven,
      })),
    },
  });
});

// ── Apply Referral Code (during/after signup) ──
router.post('/apply', authMiddleware, (req, res) => {
  const { referralCode } = req.body;
  if (!referralCode) return res.status(400).json({ error: 'CODE_REQUIRED' });

  const refData = referrals.get(referralCode.toUpperCase());
  if (!refData) return res.status(404).json({ error: 'INVALID_CODE', message: 'Referral code not found' });
  if (refData.referrerId === req.user.id) return res.status(400).json({ error: 'SELF_REFERRAL', message: 'You cannot refer yourself' });

  // Check if already referred
  const alreadyReferred = [...referrals.values()].some(r => r.referredUsers.some(u => u.userId === req.user.id));
  if (alreadyReferred) return res.status(400).json({ error: 'ALREADY_REFERRED', message: 'You have already used a referral code' });

  // Bonus amounts
  const referrerBonus = WALLET.REFERRAL_BONUS || 1000;
  const referredBonus = 500;

  // Credit referrer
  const referrerWallet = wallets.get(refData.referrerId);
  if (referrerWallet) {
    referrerWallet.coinsBalance += referrerBonus;
    referrerWallet.version++;
    const referrerTxns = transactions.get(refData.referrerId) || [];
    referrerTxns.push({
      id: uuid(), walletId: referrerWallet.id, type: 'referral', amount: referrerBonus,
      refType: 'referral', refId: req.user.id, balanceAfter: referrerWallet.coinsBalance,
      description: `🤝 Referral bonus! ${req.user.username} joined using your code`, createdAt: new Date(),
    });
    transactions.set(refData.referrerId, referrerTxns);
  }

  // Credit referred user
  const myWallet = wallets.get(req.user.id);
  if (myWallet) {
    myWallet.coinsBalance += referredBonus;
    myWallet.version++;
    const myTxns = transactions.get(req.user.id) || [];
    myTxns.push({
      id: uuid(), walletId: myWallet.id, type: 'referral', amount: referredBonus,
      refType: 'referral', refId: refData.referrerId, balanceAfter: myWallet.coinsBalance,
      description: `🎁 Welcome bonus for using referral code!`, createdAt: new Date(),
    });
    transactions.set(req.user.id, myTxns);
  }

  // Track referral
  refData.referredUsers.push({ userId: req.user.id, username: req.user.username, joinedAt: new Date(), bonusGiven: referrerBonus });
  refData.totalEarned += referrerBonus;

  logger.audit('referral_applied', req.user.id, { referralCode, referrerId: refData.referrerId, referrerBonus, referredBonus });

  res.json({
    success: true,
    message: `🎉 Referral applied! You earned ${referredBonus} coins.`,
    bonusReceived: referredBonus,
    newBalance: myWallet?.coinsBalance || 0,
  });
});

// ── Referral Stats (Admin) ──
router.get('/stats', authMiddleware, (req, res) => {
  let totalReferrals = 0;
  let totalBonusPaid = 0;
  for (const data of referrals.values()) {
    totalReferrals += data.referredUsers.length;
    totalBonusPaid += data.totalEarned;
  }
  res.json({ success: true, totalReferrals, totalBonusPaid, activeCodes: referrals.size });
});

export { referrals };
export default router;
