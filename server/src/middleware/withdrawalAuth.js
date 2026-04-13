import logger from '../utils/logger.js';
import { getWithdrawalLimits, calculateDailyWithdrawalTotal } from '../services/withdrawalProvider.js';

/**
 * Middleware to verify KYC status before allowing withdrawals
 */
export function withdrawalAuthMiddleware(req, res, next) {
  const user = req.user;

  // Only verified users can withdraw
  if (user.kycStatus !== 'verified') {
    const message =
      user.kycStatus === 'submitted'
        ? 'Your KYC is under review. Withdrawals will be available once verified.'
        : user.kycStatus === 'rejected'
          ? 'Your KYC was rejected. Please resubmit or contact support.'
          : 'KYC verification required before withdrawal.';

    logger.warn('Withdrawal denied - KYC not verified', {
      userId: user.id,
      kycStatus: user.kycStatus,
    });

    return res.status(403).json({
      error: 'KYC_NOT_VERIFIED',
      message,
      kycStatus: user.kycStatus,
    });
  }

  next();
}

/**
 * Middleware to check withdrawal limits
 */
export function withdrawalLimitsMiddleware(req, res, next) {
  const { amount } = req.body;
  const { user, accountAge } = req;

  // Verify amount is provided
  if (!amount || typeof amount !== 'number') {
    return res.status(400).json({
      error: 'INVALID_AMOUNT',
      message: 'Valid amount is required',
    });
  }

  // Get limits based on KYC and account age
  const dailyLimit = getWithdrawalLimits(user.kycStatus, accountAge || 0);

  if (amount > dailyLimit) {
    logger.warn('Withdrawal denied - exceeds daily limit', {
      userId: user.id,
      requested: amount,
      limit: dailyLimit,
    });

    return res.status(400).json({
      error: 'LIMIT_EXCEEDED',
      message: `Daily withdrawal limit is ₹${dailyLimit}`,
      dailyLimit,
    });
  }

  // Check minimum withdrawal
  if (amount < 100) {
    return res.status(400).json({
      error: 'AMOUNT_TOO_LOW',
      message: 'Minimum withdrawal is ₹100',
      minimum: 100,
    });
  }

  req.withdrawalLimit = dailyLimit;
  next();
}

/**
 * Middleware to verify bank account for withdrawal
 */
export function bankAccountVerificationMiddleware(req, res, next) {
  const { bankAccount, accountHolderName } = req.body;

  if (!bankAccount || !accountHolderName) {
    return res.status(400).json({
      error: 'MISSING_BANK_DETAILS',
      message: 'Bank account and holder name are required',
    });
  }

  // Validate account number (10-18 digits)
  if (!/^\d{10,18}$/.test(bankAccount)) {
    return res.status(400).json({
      error: 'INVALID_ACCOUNT_NUMBER',
      message: 'Invalid bank account number',
    });
  }

  // Validate account holder name (3-50 chars, letters and spaces only)
  if (!/^[a-zA-Z\s]{3,50}$/.test(accountHolderName)) {
    return res.status(400).json({
      error: 'INVALID_ACCOUNT_HOLDER',
      message: 'Invalid account holder name',
    });
  }

  next();
}
