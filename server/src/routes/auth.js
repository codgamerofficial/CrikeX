import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRY } from '../config/constants.js';
import { sendOtp, verifyOtp } from '../services/appwriteClient.js';
import { syncUser } from '../services/nhostClient.js';
import { twoFactorAuthService } from '../services/twoFactorAuth.js';
import { accountRecoveryService } from '../services/accountRecovery.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authMiddleware } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = Router();

// POST /api/v1/auth/send-otp
router.post('/send-otp', authLimiter, async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+91\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'INVALID_PHONE', message: 'Please provide a valid Indian phone number (+91XXXXXXXXXX)' });
  }

  try {
    const response = await sendOtp(phone);
    res.json(response);
  } catch (error) {
    logger.error('Failed to send OTP:', error.message);
    res.status(500).json({ error: 'OTP_SEND_FAILED', message: error.message });
  }
});

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', authLimiter, async (req, res) => {
  const { otpRef, otp, stateCode } = req.body;
  if (!otpRef || !otp) return res.status(400).json({ error: 'MISSING_FIELDS' });

  try {
    const result = await verifyOtp(otpRef, otp, stateCode);
    
    // Sync to Nhost Postgres
    await syncUser({
      id: result.user.id, // using Appwrite custom ID as UUID for Postgres
      phone: result.user.phone,
      username: result.user.username,
      role: result.user.role,
      kyc_status: result.user.kycStatus,
      state_code: result.user.stateCode,
      appwrite_id: result.user.appwriteId,
    });

    // Create stateless JWT for Gateway Fast Path
    const token = jwt.sign(
      { userId: result.user.id, role: result.user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({ success: true, token, user: result.user });
  } catch (error) {
    logger.error('Failed to verify OTP:', error.message);
    
    if (error.message.includes('INVALID_OTP') || error.message.includes('WRONG_OTP')) {
      return res.status(400).json({ error: 'WRONG_OTP', message: 'Invalid OTP' });
    }
    if (error.message.includes('EXPIRED')) {
      return res.status(400).json({ error: 'OTP_EXPIRED', message: 'OTP has expired' });
    }
    
    res.status(400).json({ error: 'VERIFY_FAILED', message: error.message });
  }
});

// POST /api/v1/auth/refresh (still uses stateless JWT refresh for speeed)
router.post('/refresh', (req, res) => {
  const { token: oldToken } = req.body;
  try {
    const decoded = jwt.verify(oldToken, JWT_SECRET, { ignoreExpiration: true });
    const token = jwt.sign({ userId: decoded.userId, role: decoded.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({ success: true, token });
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN' });
  }
});

// ── 2FA ROUTES ──

// POST /api/v1/auth/2fa/setup
// Generate 2FA secret and QR code
router.post('/2fa/setup', authMiddleware, async (req, res) => {
  try {
    const result = await twoFactorAuthService.generateSecret(req.user.id, req.user.email || `user_${req.user.id}@crikex.app`);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      manualEntryKey: result.manualEntryKey,
      message: 'Scan QR code with authenticator app and enter the 6-digit code to verify',
      recommendedApps: twoFactorAuthService.getRecommendedApps(),
    });
  } catch (error) {
    logger.error('2FA setup failed', { userId: req.user.id, error: error.message });
    res.status(500).json({ error: 'SETUP_FAILED', message: error.message });
  }
});

// POST /api/v1/auth/2fa/verify-setup
// Verify 2FA setup with token
router.post('/2fa/verify-setup', authMiddleware, (req, res) => {
  const { token, secret, backupCodes } = req.body;

  if (!token || !secret || !backupCodes) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  try {
    const result = twoFactorAuthService.verifySetup(req.user.id, token, backupCodes, secret);

    if (!result.success) {
      return res.status(400).json({ error: result.error, message: result.message });
    }

    logger.info('2FA verified and enabled', { userId: req.user.id });

    res.json({
      success: true,
      message: result.message,
      backupCodes: result.backupCodes,
      backupMessage: result.backupMessage,
    });
  } catch (error) {
    logger.error('2FA verification failed', { userId: req.user.id, error: error.message });
    res.status(500).json({ error: 'VERIFICATION_FAILED' });
  }
});

// POST /api/v1/auth/2fa/verify-login
// Verify 2FA token during login
router.post('/2fa/verify-login', (req, res) => {
  const { userId, token } = req.body;

  if (!userId || !token) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  try {
    const result = twoFactorAuthService.verifyToken(userId, token);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        message: result.message,
        attemptsRemaining: twoFactorAuthService.recoveryAttempts.get(userId)?.count,
      });
    }

    // Issue JWT token after successful 2FA verification
    const token_jwt = jwt.sign({ userId, role: 'user' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    logger.info('2FA login verified', { userId, method: result.method });

    res.json({
      success: true,
      message: result.message,
      token: token_jwt,
    });
  } catch (error) {
    logger.error('2FA login verification failed', { userId, error: error.message });
    res.status(500).json({ error: 'VERIFICATION_FAILED' });
  }
});

// GET /api/v1/auth/2fa/status
// Get 2FA status for current user
router.get('/2fa/status', authMiddleware, (req, res) => {
  try {
    const status = twoFactorAuthService.getStatus(req.user.id);

    res.json({
      success: true,
      twoFactorAuth: status,
    });
  } catch (error) {
    res.status(500).json({ error: 'STATUS_ERROR' });
  }
});

// POST /api/v1/auth/2fa/disable
// Disable 2FA for user
router.post('/2fa/disable', authMiddleware, (req, res) => {
  const { passwordConfirmed } = req.body;

  if (!passwordConfirmed) {
    return res.status(400).json({
      error: 'PASSWORD_REQUIRED',
      message: 'Password verification required to disable 2FA',
    });
  }

  try {
    const result = twoFactorAuthService.disable2FA(req.user.id, passwordConfirmed);

    if (!result.success) {
      return res.status(400).json({ error: result.error, message: result.message });
    }

    logger.warn('2FA disabled', { userId: req.user.id });

    res.json({ success: true, message: result.message });
  } catch (error) {
    res.status(500).json({ error: 'DISABLE_FAILED' });
  }
});

// POST /api/v1/auth/2fa/regenerate-backup-codes
// Generate new backup codes
router.post('/2fa/regenerate-backup-codes', authMiddleware, (req, res) => {
  try {
    const result = twoFactorAuthService.regenerateBackupCodes(req.user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    logger.info('Backup codes regenerated', { userId: req.user.id });

    res.json({
      success: true,
      backupCodes: result.backupCodes,
      message: result.message,
    });
  } catch (error) {
    res.status(500).json({ error: 'REGENERATION_FAILED' });
  }
});

// ── ACCOUNT RECOVERY ROUTES ──

// POST /api/v1/auth/forgot-password
// Initiate password recovery
router.post('/forgot-password', authLimiter, (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: 'INVALID_EMAIL',
      message: 'Please provide a valid email address',
    });
  }

  try {
    // In production, lookup user by email
    // For now, generate token with email
    const result = accountRecoveryService.initiateRecovery(email, email, null);

    logger.info('Password recovery initiated', { email });

    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive recovery instructions',
      // Don't reveal if account exists or not (security best practice)
    });
  } catch (error) {
    logger.error('Password recovery initiation failed', { email, error: error.message });
    res.status(500).json({ error: 'RECOVERY_FAILED' });
  }
});

// POST /api/v1/auth/verify-recovery-token
// Validate password recovery token
router.post('/verify-recovery-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'MISSING_TOKEN' });
  }

  try {
    const info = accountRecoveryService.getRecoverySessionInfo(token);

    if (!info.valid) {
      return res.status(400).json({
        error: info.error,
        message: info.message || 'Invalid or expired recovery token',
      });
    }

    res.json({
      success: true,
      valid: true,
      email: info.email,
      expiresAt: info.expiresAt,
      timeRemaining: info.timeRemaining,
    });
  } catch (error) {
    res.status(500).json({ error: 'VERIFICATION_FAILED' });
  }
});

// POST /api/v1/auth/reset-password
// Complete password reset
router.post('/reset-password', authLimiter, (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      error: 'PASSWORDS_MISMATCH',
      message: 'Passwords do not match',
    });
  }

  try {
    const result = accountRecoveryService.completePasswordReset(token, newPassword);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        message: result.message,
      });
    }

    logger.info('Password reset completed', { userId: result.userId });

    res.json({
      success: true,
      message: result.message,
      redirectTo: '/login',
    });
  } catch (error) {
    logger.error('Password reset failed', { error: error.message });
    res.status(500).json({ error: 'RESET_FAILED' });
  }
});

// POST /api/v1/auth/verify-email-code
// Verify email code (for account verification / sensitive operations)
router.post('/verify-email-code', authLimiter, (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: 'MISSING_FIELDS' });
  }

  try {
    const result = accountRecoveryService.verifyEmailCode(email, code);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        message: result.message,
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    logger.info('Email verified', { email });

    res.json({
      success: true,
      message: result.message,
      verifiedAt: result.verifiedAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'VERIFICATION_FAILED' });
  }
});

// POST /api/v1/auth/send-email-verification
// Send email verification code
router.post('/send-email-verification', authMiddleware, (req, res) => {
  const { email, purpose = 'email_verification' } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'MISSING_EMAIL' });
  }

  try {
    const result = accountRecoveryService.generateVerificationCode(email, purpose);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // In production, send via email
    logger.info('Verification code sent', { email, purpose });

    res.json({
      success: true,
      message: result.message,
      // Don't return code in production - send via email only
    });
  } catch (error) {
    logger.error('Verification code send failed', { email, error: error.message });
    res.status(500).json({ error: 'SEND_FAILED' });
  }
});

// GET /api/v1/auth/recovery-requirements/:kycStatus
// Get account recovery requirements based on KYC status
router.get('/recovery-requirements/:kycStatus', (req, res) => {
  try {
    const { kycStatus } = req.params;
    const requirements = accountRecoveryService.getRecoveryRequirements(kycStatus);

    res.json({
      success: true,
      kycStatus,
      requirements,
    });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_FAILED' });
  }
});

export default router;
