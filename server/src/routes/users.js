import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { users, kycRecords } from '../data/store.js';

const router = Router();
router.use(authMiddleware);

// GET /api/v1/users/me
router.get('/me', (req, res) => {
  const u = req.user;
  res.json({ success: true, user: { id: u.id, phone: u.phone, email: u.email, username: u.username, avatarUrl: u.avatarUrl, role: u.role, stateCode: u.stateCode, kycStatus: u.kycStatus, createdAt: u.createdAt } });
});

// PATCH /api/v1/users/me
router.patch('/me', (req, res) => {
  const { username, email, avatarUrl } = req.body;
  const user = users.get(req.user.id);
  if (username) {
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'INVALID_USERNAME' });
    const taken = [...users.values()].some(u => u.username === username && u.id !== user.id);
    if (taken) return res.status(409).json({ error: 'USERNAME_TAKEN' });
    user.username = username;
  }
  if (email) user.email = email;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  res.json({ success: true, user });
});

// POST /api/v1/users/kyc
router.post('/kyc', (req, res) => {
  const { panNumber, aadhaarLast4, fullName, dob } = req.body;
  if (!panNumber || !fullName || !dob) return res.status(400).json({ error: 'MISSING_FIELDS' });
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) return res.status(400).json({ error: 'INVALID_PAN', message: 'PAN format: ABCDE1234F' });

  const kycId = uuid();
  const record = { id: kycId, userId: req.user.id, panNumber: `XXXX${panNumber.slice(-4)}`, aadhaarLast4: aadhaarLast4 || '****', fullName, dob, status: 'submitted', createdAt: new Date() };
  kycRecords.set(req.user.id, record);

  const user = users.get(req.user.id);
  user.kycStatus = 'submitted';

  // Auto-verify after 2 seconds (simulates async verification)
  setTimeout(() => {
    record.status = 'verified';
    record.reviewedAt = new Date();
    user.kycStatus = 'verified';
  }, 2000);

  res.status(201).json({ success: true, kyc: record, message: 'KYC submitted for verification' });
});

// GET /api/v1/users/kyc/status
router.get('/kyc/status', (req, res) => {
  const record = kycRecords.get(req.user.id);
  res.json({ success: true, kycStatus: req.user.kycStatus, record: record || null });
});

export default router;
