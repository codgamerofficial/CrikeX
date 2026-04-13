import { v4 as uuid } from 'uuid';
import logger from '../utils/logger.js';

/**
 * Account Recovery Service
 * Handles password reset, account recovery, and email verification
 */
export class AccountRecoveryService {
  constructor() {
    this.recoveryTokens = new Map(); // token -> { userId, type, email, createdAt, expiresAt, used }
    this.verificationCodes = new Map(); // email -> { code, attempts, createdAt, expiresAt }
  }

  /**
   * Initiate password recovery
   */
  initiateRecovery(userId, email, phone) {
    try {
      // Generate recovery token (valid for 30 minutes)
      const token = uuid();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30);

      this.recoveryTokens.set(token, {
        userId,
        type: 'password_reset',
        email,
        phone,
        createdAt: new Date(),
        expiresAt,
        used: false,
      });

      logger.info('Password recovery initiated', { userId, email });

      return {
        success: true,
        token,
        expiresAt,
        message: 'Recovery link sent to your email',
        recoveryLink: `/reset-password?token=${token}`,
      };
    } catch (error) {
      logger.error('Password recovery initiation failed', { userId, error: error.message });
      return {
        success: false,
        error: 'INITIATION_FAILED',
      };
    }
  }

  /**
   * Validate recovery token
   */
  validateToken(token) {
    try {
      const record = this.recoveryTokens.get(token);

      if (!record) {
        return {
          valid: false,
          error: 'INVALID_TOKEN',
          message: 'Recovery token not found',
        };
      }

      if (record.used) {
        return {
          valid: false,
          error: 'TOKEN_USED',
          message: 'This recovery token has already been used',
        };
      }

      if (new Date() > record.expiresAt) {
        return {
          valid: false,
          error: 'TOKEN_EXPIRED',
          message: 'Recovery token has expired. Please request a new one.',
        };
      }

      return {
        valid: true,
        userId: record.userId,
        type: record.type,
        expiresAt: record.expiresAt,
      };
    } catch (error) {
      logger.error('Token validation failed', { token, error: error.message });
      return {
        valid: false,
        error: 'VALIDATION_FAILED',
      };
    }
  }

  /**
   * Complete password reset
   */
  completePasswordReset(token, newPassword) {
    try {
      const validation = this.validateToken(token);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          message: validation.message,
        };
      }

      // Validate new password
      if (!newPassword || newPassword.length < 8) {
        return {
          success: false,
          error: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters long',
        };
      }

      // Mark token as used
      const record = this.recoveryTokens.get(token);
      record.used = true;
      record.usedAt = new Date();

      logger.info('Password reset completed', { userId: record.userId });

      return {
        success: true,
        userId: record.userId,
        message: 'Password successfully reset. You can now login with your new password.',
      };
    } catch (error) {
      logger.error('Password reset failed', { token, error: error.message });
      return {
        success: false,
        error: 'RESET_FAILED',
      };
    }
  }

  /**
   * Generate email verification code (for sensitive operations)
   */
  generateVerificationCode(email, purpose = 'email_verification') {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // Valid for 15 minutes

      this.verificationCodes.set(email, {
        code,
        purpose,
        attempts: 0,
        createdAt: new Date(),
        expiresAt,
        verified: false,
      });

      logger.info('Verification code generated', { email, purpose });

      return {
        success: true,
        code, // In production, send via email, not return directly
        expiresAt,
        message: 'Verification code sent to your email',
      };
    } catch (error) {
      logger.error('Verification code generation failed', { email, error: error.message });
      return {
        success: false,
        error: 'GENERATION_FAILED',
      };
    }
  }

  /**
   * Verify email code
   */
  verifyEmailCode(email, code) {
    try {
      const record = this.verificationCodes.get(email);

      if (!record) {
        return {
          success: false,
          error: 'NO_CODE',
          message: 'No verification code found for this email',
        };
      }

      if (record.verified) {
        return {
          success: false,
          error: 'ALREADY_VERIFIED',
          message: 'Email already verified',
        };
      }

      if (new Date() > record.expiresAt) {
        return {
          success: false,
          error: 'CODE_EXPIRED',
          message: 'Verification code has expired',
        };
      }

      record.attempts++;

      if (record.attempts > 5) {
        this.verificationCodes.delete(email);
        return {
          success: false,
          error: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed attempts. Please request a new code.',
        };
      }

      if (record.code !== code) {
        return {
          success: false,
          error: 'INVALID_CODE',
          message: `Invalid code. ${5 - record.attempts} attempts remaining.`,
          attemptsRemaining: 5 - record.attempts,
        };
      }

      record.verified = true;
      record.verifiedAt = new Date();

      logger.info('Email verified', { email });

      return {
        success: true,
        message: 'Email verified successfully',
        verifiedAt: record.verifiedAt,
      };
    } catch (error) {
      logger.error('Code verification failed', { email, error: error.message });
      return {
        success: false,
        error: 'VERIFICATION_FAILED',
      };
    }
  }

  /**
   * Check account recovery requirements based on KYC
   */
  getRecoveryRequirements(kycStatus) {
    const requirements = {
      verified: {
        methods: ['email', 'phone', 'kyc_document'],
        required: ['email'],
        timeToProcess: '24 hours',
      },
      submitted: {
        methods: ['email', 'phone'],
        required: ['email'],
        timeToProcess: '48 hours',
      },
      pending: {
        methods: ['email'],
        required: ['email'],
        timeToProcess: '72 hours',
      },
      rejected: {
        methods: [],
        required: [],
        message: 'KYC was rejected. Please resubmit or contact support.',
      },
    };

    return requirements[kycStatus] || requirements.pending;
  }

  /**
   * Get recovery session info
   */
  getRecoverySessionInfo(token) {
    const validation = this.validateToken(token);

    if (!validation.valid) {
      return {
        valid: false,
        error: validation.error,
      };
    }

    const record = this.recoveryTokens.get(token);

    return {
      valid: true,
      type: record.type,
      email: record.email,
      phone: record.phone,
      expiresAt: record.expiresAt,
      timeRemaining: Math.floor((record.expiresAt - new Date()) / 1000), // seconds
    };
  }

  /**
   * Clean up expired tokens (call periodically via cron)
   */
  cleanupExpiredTokens() {
    let cleaned = 0;

    for (const [token, record] of this.recoveryTokens.entries()) {
      if (new Date() > record.expiresAt && record.used) {
        this.recoveryTokens.delete(token);
        cleaned++;
      }
    }

    logger.debug('Expired tokens cleaned up', { count: cleaned });

    return cleaned;
  }
}

export const accountRecoveryService = new AccountRecoveryService();
