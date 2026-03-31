import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { JWT_SECRET, JWT_EXPIRY, WALLET } from '../config/constants.js';
import { users, otpStore, wallets, transactions } from '../data/store.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// POST /api/v1/auth/send-otp
router.post('/send-otp', authLimiter, (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+91\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'INVALID_PHONE', message: 'Please provide a valid Indian phone number (+91XXXXXXXXXX)' });
  }
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const otpRef = uuid().slice(0, 8);
  otpStore.set(otpRef, { phone, otp, expiresAt: Date.now() + 300000, attempts: 0 });
  console.log(`[OTP] ${phone} → ${otp} (ref: ${otpRef})`);
  const response = { success: true, otpRef, message: 'OTP sent successfully' };
  if ((process.env.NODE_ENV || '').trim() !== 'production') response.hint_dev = otp;
  res.json(response);
});

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', authLimiter, (req, res) => {
  const { otpRef, otp, stateCode } = req.body;
  if (!otpRef || !otp) return res.status(400).json({ error: 'MISSING_FIELDS' });
  const record = otpStore.get(otpRef);
  if (!record) return res.status(400).json({ error: 'INVALID_OTP_REF' });
  if (Date.now() > record.expiresAt) { otpStore.delete(otpRef); return res.status(400).json({ error: 'OTP_EXPIRED' }); }
  record.attempts++;
  if (record.attempts > 3) { otpStore.delete(otpRef); return res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' }); }
  if (record.otp !== otp) return res.status(400).json({ error: 'WRONG_OTP' });

  otpStore.delete(otpRef);
  // Find or create user
  let user = [...users.values()].find(u => u.phone === record.phone);
  if (!user) {
    const id = uuid();
    user = { id, phone: record.phone, email: null, username: `Player${Date.now().toString(36)}`, avatarUrl: null, role: 'user', stateCode: stateCode || 'IN-MH', isBlocked: false, kycStatus: 'pending', createdAt: new Date() };
    users.set(id, user);
    wallets.set(id, { id: uuid(), userId: id, coinsBalance: WALLET.STARTING_COINS, premiumBalance: 0, version: 0, updatedAt: new Date() });
    transactions.set(id, [{ id: uuid(), walletId: id, type: 'bonus', amount: WALLET.STARTING_COINS, refType: 'signup', refId: null, balanceAfter: WALLET.STARTING_COINS, description: 'Welcome bonus! 🎉', createdAt: new Date() }]);
  }
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ success: true, token, user: { id: user.id, username: user.username, phone: user.phone, role: user.role, kycStatus: user.kycStatus, stateCode: user.stateCode } });
});

// POST /api/v1/auth/refresh
router.post('/refresh', (req, res) => {
  const { token: oldToken } = req.body;
  try {
    const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
    const user = users.get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'USER_NOT_FOUND' });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({ success: true, token });
  } catch { res.status(401).json({ error: 'INVALID_TOKEN' }); }
});

export default router;
