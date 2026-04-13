import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import logger from '../utils/logger.js';

/**
 * Two-Factor Authentication Service
 * Supports: TOTP (Time-based OTP) via Google Authenticator/Authy
 */
export class TwoFactorAuthService {
  constructor() {
    this.userSecrets = new Map(); // userId -> { secret, backupCodes, enabledAt, verified }
    this.recoveryAttempts = new Map(); // userId -> { count, lastAttempt }
  }

  /**
   * Generate 2FA secret and QR code
   */
  async generateSecret(userId, userEmail) {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `CrikeX (${userEmail})`,
        issuer: 'CrikeX',
        length: 32,
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url);

      // Generate backup codes (10 codes, 8 chars each)
      const backupCodes = Array(10)
        .fill(null)
        .map(() => Math.random().toString(36).substring(2, 10).toUpperCase());

      logger.info('2FA secret generated', { userId });

      return {
        success: true,
        secret: secret.base32,
        qrCode,
        backupCodes,
        manualEntryKey: secret.base32,
      };
    } catch (error) {
      logger.error('2FA secret generation failed', { userId, error: error.message });
      return {
        success: false,
        error: 'GENERATION_FAILED',
      };
    }
  }

  /**
   * Verify 2FA setup - user provides OTP token
   */
  verifySetup(userId, token, backupCodes, secret) {
    try {
      // Verify the token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time windows of drift
      });

      if (!verified) {
        return {
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid OTP token. Please try again.',
        };
      }

      // Store secret and backup codes
      this.userSecrets.set(userId, {
        secret,
        backupCodes,
        enabledAt: new Date(),
        verified: true,
        lastUsed: null,
      });

      logger.info('2FA setup verified', { userId });

      return {
        success: true,
        message: '2FA successfully enabled',
        backupCodes,
        backupMessage: 'Save these backup codes in a safe place. You can use them to login if you lose access to your authenticator app.',
      };
    } catch (error) {
      logger.error('2FA verification failed', { userId, error: error.message });
      return {
        success: false,
        error: 'VERIFICATION_FAILED',
      };
    }
  }

  /**
   * Verify OTP token during login
   */
  verifyToken(userId, token) {
    try {
      const userSecret = this.userSecrets.get(userId);

      if (!userSecret || !userSecret.verified) {
        return {
          success: false,
          error: 'NOT_ENABLED',
          message: '2FA not enabled for this account',
        };
      }

      // Check backup codes first
      if (userSecret.backupCodes.includes(token)) {
        logger.warn('Backup code used', { userId });

        // Remove used backup code
        userSecret.backupCodes = userSecret.backupCodes.filter(code => code !== token);

        return {
          success: true,
          method: 'backup_code',
          message: 'Backup code accepted',
        };
      }

      // Verify OTP token
      const verified = speakeasy.totp.verify({
        secret: userSecret.secret,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (!verified) {
        this.recordFailedAttempt(userId);
        return {
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Invalid OTP token',
        };
      }

      // Reset failed attempts
      this.recoveryAttempts.delete(userId);

      logger.info('2FA token verified', { userId, method: 'totp' });

      return {
        success: true,
        method: 'totp',
        message: 'OTP verified',
      };
    } catch (error) {
      logger.error('Token verification failed', { userId, error: error.message });
      return {
        success: false,
        error: 'VERIFICATION_FAILED',
      };
    }
  }

  /**
   * Disable 2FA
   */
  disable2FA(userId, passwordVerification = false) {
    try {
      if (!passwordVerification) {
        return {
          success: false,
          error: 'PASSWORD_REQUIRED',
          message: 'Password verification required to disable 2FA',
        };
      }

      this.userSecrets.delete(userId);
      this.recoveryAttempts.delete(userId);

      logger.warn('2FA disabled', { userId });

      return {
        success: true,
        message: '2FA successfully disabled',
      };
    } catch (error) {
      logger.error('2FA disable failed', { userId, error: error.message });
      return {
        success: false,
        error: 'DISABLE_FAILED',
      };
    }
  }

  /**
   * Check if 2FA is enabled for user
   */
  isEnabled(userId) {
    const userSecret = this.userSecrets.get(userId);
    return userSecret?.verified === true;
  }

  /**
   * Get 2FA status
   */
  getStatus(userId) {
    const userSecret = this.userSecrets.get(userId);

    return {
      enabled: userSecret?.verified === true,
      enabledAt: userSecret?.enabledAt || null,
      backupCodesRemaining: userSecret?.backupCodes?.length || 0,
      lastUsed: userSecret?.lastUsed || null,
    };
  }

  /**
   * Generate new backup codes
   */
  regenerateBackupCodes(userId) {
    try {
      const userSecret = this.userSecrets.get(userId);

      if (!userSecret || !userSecret.verified) {
        return {
          success: false,
          error: 'NOT_ENABLED',
        };
      }

      const newBackupCodes = Array(10)
        .fill(null)
        .map(() => Math.random().toString(36).substring(2, 10).toUpperCase());

      userSecret.backupCodes = newBackupCodes;

      logger.info('Backup codes regenerated', { userId });

      return {
        success: true,
        backupCodes: newBackupCodes,
        message: 'New backup codes generated',
      };
    } catch (error) {
      logger.error('Backup codes regeneration failed', { userId, error: error.message });
      return {
        success: false,
        error: 'REGENERATION_FAILED',
      };
    }
  }

  /**
   * Record failed verification attempts
   */
  recordFailedAttempt(userId) {
    const attempts = this.recoveryAttempts.get(userId) || { count: 0, lastAttempt: null };
    attempts.count++;
    attempts.lastAttempt = new Date();

    this.recoveryAttempts.set(userId, attempts);

    // Lock account after 5 failed attempts
    if (attempts.count >= 5) {
      logger.warn('Too many 2FA failures', { userId, attempts: attempts.count });
      return { locked: true, message: 'Account locked due to multiple failed attempts. Contact support.' };
    }

    return { locked: false, attemptsRemaining: 5 - attempts.count };
  }

  /**
   * Clear failed attempts
   */
  clearFailedAttempts(userId) {
    this.recoveryAttempts.delete(userId);
  }

  /**
   * Get recommended authenticator apps
   */
  getRecommendedApps() {
    return {
      recommended: [
        { name: 'Google Authenticator', url: 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2' },
        { name: 'Microsoft Authenticator', url: 'https://apps.apple.com/app/microsoft-authenticator/id981333031' },
        { name: 'Authy', url: 'https://authy.com/download/' },
      ],
      instructions: [
        '1. Download and install an authenticator app from the links above',
        '2. Open the app and tap the + button to add a new account',
        '3. Scan the QR code shown on your screen',
        '4. Enter the 6-digit code in CrikeX to verify',
        '5. Save your backup codes in a secure location',
      ],
    };
  }
}

export const twoFactorAuthService = new TwoFactorAuthService();
