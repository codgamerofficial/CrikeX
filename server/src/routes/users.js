import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { users, kycRecords } from '../data/store.js';
import { initiateKYCVerification, submitManualKYC } from '../services/kycProvider.js';
import { acceptanceTracker } from '../services/policyTracker.js';
import logger from '../utils/logger.js';

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

  const user = users.get(req.user.id);
  const kycId = uuid();

  // Try Razorpay KYC first
  initiateKYCVerification(user)
    .then(async (kycResult) => {
      if (kycResult.success) {
        // Razorpay integration successful
        const record = {
          id: kycId,
          userId: req.user.id,
          panNumber: `XXXX${panNumber.slice(-4)}`,
          aadhaarLast4: aadhaarLast4 || '****',
          fullName,
          dob,
          status: 'pending',
          provider: 'razorpay',
          accountId: kycResult.accountId,
          createdAt: new Date(),
        };
        kycRecords.set(req.user.id, record);
        user.kycStatus = 'pending';

        logger.info('KYC initiated via Razorpay', { userId: req.user.id, accountId: kycResult.accountId });

        res.status(201).json({
          success: true,
          kyc: record,
          message: 'KYC initiated. Please complete verification.',
        });
      } else {
        // Fallback to manual KYC
        throw new Error('Razorpay unavailable, using fallback');
      }
    })
    .catch(async (error) => {
      logger.warn('Razorpay KYC unavailable, using manual verification', { userId: req.user.id });

      // Fallback to manual KYC verification
      const manualResult = await submitManualKYC(req.user.id, { panNumber, aadhaarLast4, fullName, dob });

      if (manualResult.success) {
        const record = {
          id: kycId,
          userId: req.user.id,
          panNumber: `XXXX${panNumber.slice(-4)}`,
          aadhaarLast4: aadhaarLast4 || '****',
          fullName,
          dob,
          status: 'pending_review',
          provider: 'manual',
          createdAt: new Date(),
        };
        kycRecords.set(req.user.id, record);
        user.kycStatus = 'submitted';

        res.status(201).json({
          success: true,
          kyc: record,
          message: 'KYC submitted for manual review. Our team will review within 24 hours.',
        });
      } else {
        res.status(500).json({ error: 'KYC_SUBMISSION_FAILED', message: 'Unable to process KYC at this time' });
      }
    });
});

// Get KYC status
router.get('/kyc/status', (req, res) => {
  const record = kycRecords.get(req.user.id);
  res.json({ success: true, kycStatus: req.user.kycStatus, record: record || null });
});

// Webhook: KYC status update from Razorpay
router.post('/kyc/webhook', (req, res) => {
  const { account_id, status } = req.body;

  // Find user by account_id and update their KYC status
  let updatedUser = null;
  for (const [userId, record] of kycRecords) {
    if (record.accountId === account_id) {
      const statusMap = {
        active: 'verified',
        suspended: 'rejected',
        processing: 'submitted',
        rejected: 'rejected',
      };

      record.status = statusMap[status] || 'pending';
      record.razorpayStatus = status;
      record.updatedAt = new Date();

      const user = users.get(userId);
      if (user) {
        user.kycStatus = record.status;
        updatedUser = user;
      }

      logger.info('KYC status updated via webhook', { userId, status: record.status });
      break;
    }
  }

  res.json({ success: true, updated: !!updatedUser });
});

// POST /api/v1/users/accept-terms
// Record user's acceptance of Terms of Service
router.post('/accept-terms', (req, res) => {
  try {
    const { version = '1.0' } = req.body;
    const userId = req.user.id;

    const record = acceptanceTracker.recordAcceptance(userId, version);

    // Update user record to mark terms accepted
    const user = users.get(userId);
    if (user) {
      user.termsAcceptedAt = new Date();
      user.termsVersion = version;
    }

    res.json({
      success: true,
      message: 'Terms accepted',
      acceptedAt: record.acceptedAt,
    });
  } catch (err) {
    logger.error('Terms acceptance error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'ACCEPTANCE_FAILED', message: err.message });
  }
});

// POST /api/v1/users/accept-privacy
// Record user's acceptance of Privacy Policy
router.post('/accept-privacy', (req, res) => {
  try {
    const { version = '1.0' } = req.body;
    const userId = req.user.id;

    const record = acceptanceTracker.recordAcceptance(userId, version);

    // Update user record
    const user = users.get(userId);
    if (user) {
      user.privacyAcceptedAt = new Date();
      user.privacyVersion = version;
    }

    res.json({
      success: true,
      message: 'Privacy policy accepted',
      acceptedAt: record.acceptedAt,
    });
  } catch (err) {
    logger.error('Privacy acceptance error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'ACCEPTANCE_FAILED', message: err.message });
  }
});

// GET /api/v1/users/acceptance-status
// Check if user has accepted current T&C and Privacy Policy
router.get('/acceptance-status', (req, res) => {
  try {
    const userId = req.user.id;
    const record = acceptanceTracker.getAcceptanceHistory(userId);
    const user = users.get(userId);

    res.json({
      success: true,
      accepted: {
        terms: !!user?.termsAcceptedAt,
        privacy: !!user?.privacyAcceptedAt,
      },
      versions: {
        terms: user?.termsVersion || null,
        privacy: user?.privacyVersion || null,
      },
      history: record,
    });
  } catch (err) {
    res.status(500).json({ error: 'STATUS_ERROR', message: err.message });
  }
});

export default router;
