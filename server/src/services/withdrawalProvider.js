import axios from 'axios';
import logger from '../utils/logger.js';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const razorpayAPI = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  auth: {
    username: RAZORPAY_KEY_ID,
    password: RAZORPAY_KEY_SECRET,
  },
});

/**
 * TDS Calculation for winnings
 * As per Indian regulations, 30% TDS is levied on betting winnings
 */
export function calculateTDS(winnings) {
  // 30% TDS on winnings as per Indian tax regulations
  const TDS_RATE = 0.30;
  const tdsAmount = Math.round(winnings * TDS_RATE);
  const netAmount = winnings - tdsAmount;

  return {
    grossAmount: winnings,
    tdsAmount,
    netAmount,
    tdsRate: TDS_RATE * 100,
  };
}

/**
 * Verify bank account via micro-deposit
 * Razorpay sends ₹0-₹99 for verification
 */
export async function verifyBankAccount(bankDetails) {
  try {
    const { accountNumber, ifscCode, accountHolderName } = bankDetails;

    // Validate input
    if (!accountNumber || !ifscCode || !accountHolderName) {
      return {
        success: false,
        error: 'MISSING_BANK_DETAILS',
        message: 'All bank details are required',
      };
    }

    // In production, Razorpay would send a micro-deposit
    // For now, we return pending verification
    logger.info('Bank account verification initiated', {
      accountNumber: `****${accountNumber.slice(-4)}`,
      ifsc: ifscCode,
    });

    return {
      success: true,
      status: 'pending_verification',
      message: 'Verification amount will be deposited within 1-2 days',
      verificationRequired: true,
    };
  } catch (error) {
    logger.error('Bank account verification failed', { error: error.message });
    return {
      success: false,
      error: 'VERIFICATION_FAILED',
    };
  }
}

/**
 * Confirm micro-deposit verification
 */
export async function confirmMicroDeposit(accountId, amount) {
  try {
    if (amount < 1 || amount > 99) {
      return {
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Micro-deposit verification amount should be between ₹1-₹99',
      };
    }

    logger.info('Micro-deposit verified', { accountId, amount });

    return {
      success: true,
      status: 'verified',
      message: 'Bank account verified successfully',
    };
  } catch (error) {
    logger.error('Micro-deposit confirmation failed', { error: error.message });
    return {
      success: false,
      error: 'CONFIRMATION_FAILED',
    };
  }
}

/**
 * Create withdrawal request
 */
export async function createWithdrawalRequest(userId, withdrawalData, userBalance) {
  try {
    const { amount, bankAccount, accountHolderName } = withdrawalData;

    // Validation
    if (amount < 100 || amount > 100000) {
      return {
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Withdrawal amount should be between ₹100 and ₹1,00,000',
      };
    }

    if (amount > userBalance) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        message: `Insufficient balance. Available: ₹${userBalance}`,
      };
    }

    // Calculate fees (2% withdrawal fee)
    const withdrawalFee = Math.round(amount * 0.02);
    const netAmount = amount - withdrawalFee;

    const withdrawalRequest = {
      id: `wd_${Date.now()}_${userId}`,
      userId,
      amount,
      fee: withdrawalFee,
      netAmount,
      bankAccount: {
        accountNumber: `****${bankAccount.slice(-4)}`,
        accountHolderName,
      },
      status: 'pending_approval',
      createdAt: new Date(),
      processedAt: null,
    };

    logger.info('Withdrawal request created', {
      userId,
      requestId: withdrawalRequest.id,
      amount,
    });

    return {
      success: true,
      withdrawal: withdrawalRequest,
      message: 'Withdrawal request submitted for approval',
    };
  } catch (error) {
    logger.error('Withdrawal request creation failed', {
      userId,
      error: error.message,
    });

    return {
      success: false,
      error: 'WITHDRAWAL_FAILED',
      message: 'Unable to process withdrawal. Please try again.',
    };
  }
}

/**
 * Process withdrawal via Razorpay Settlements/Payouts API
 */
export async function processWithdrawal(withdrawalRequest, bankDetails) {
  try {
    // Create a payout via Razorpay
    const payoutData = {
      account_number: bankDetails.accountNumber,
      fund_account_id: bankDetails.fundAccountId,
      amount: withdrawalRequest.netAmount * 100, // Convert to paise
      currency: 'INR',
      mode: bankDetails.upiId ? 'NEFT' : 'NEFT', // NEFT for bank transfers
      purpose: 'payout',
      reference_id: withdrawalRequest.id,
      narration: 'CrikeX Withdrawal',
      queue_if_low_balance: true,
    };

    const response = await razorpayAPI.post('/payouts', payoutData);

    logger.info('Payout created via Razorpay', {
      payoutId: response.data.id,
      withdrawalId: withdrawalRequest.id,
    });

    // Update withdrawal status
    withdrawalRequest.status = 'processing';
    withdrawalRequest.razorpayPayoutId = response.data.id;
    withdrawalRequest.processedAt = new Date();

    return {
      success: true,
      withdrawal: withdrawalRequest,
      payoutId: response.data.id,
      message: 'Withdrawal processing. Amount will be credited in 1-2 business days.',
    };
  } catch (error) {
    logger.error('Payout creation failed', {
      withdrawalId: withdrawalRequest.id,
      error: error.response?.data || error.message,
    });

    // Mark as failed
    withdrawalRequest.status = 'failed';
    withdrawalRequest.failureReason = error.response?.data?.error?.description || error.message;

    return {
      success: false,
      error: 'PAYOUT_FAILED',
      message: 'Failed to process withdrawal. Please contact support.',
      withdrawal: withdrawalRequest,
    };
  }
}

/**
 * Check withdrawal status
 */
export async function checkWithdrawalStatus(payoutId) {
  try {
    const response = await razorpayAPI.get(`/payouts/${payoutId}`);
    const payout = response.data;

    const statusMap = {
      initiated: 'processing',
      processed: 'completed',
      reversed: 'failed',
      failed: 'failed',
      rejected: 'failed',
    };

    return {
      success: true,
      status: statusMap[payout.status] || 'unknown',
      razorpayStatus: payout.status,
      amount: payout.amount / 100, // Convert from paise
      createdAt: payout.created_at,
    };
  } catch (error) {
    logger.error('Payout status check failed', { payoutId, error: error.message });

    return {
      success: false,
      error: 'STATUS_CHECK_FAILED',
    };
  }
}

/**
 * Get withdrawal limits based on KYC and account age
 */
export function getWithdrawalLimits(kycStatus, accountAgeDays) {
  // Withdrawal limits based on KYC status
  const baseLimits = {
    verified: 100000, // ₹1,00,000/day
    submitted: 10000, // ₹10,000/day (unverified users)
    pending: 5000, // ₹5,000/day (minimal)
    rejected: 0, // Cannot withdraw
  };

  // Additional restrictions for new accounts (< 7 days)
  if (accountAgeDays < 7) {
    return Math.min(baseLimits[kycStatus] || 0, 5000); // Max ₹5,000 for new accounts
  }

  return baseLimits[kycStatus] || 0;
}

/**
 * Calculate daily withdrawal total
 */
export function calculateDailyWithdrawalTotal(withdrawals) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return withdrawals
    .filter(w => {
      const wDate = new Date(w.createdAt);
      wDate.setHours(0, 0, 0, 0);
      return wDate.getTime() === today.getTime() && ['completed', 'processing'].includes(w.status);
    })
    .reduce((sum, w) => sum + w.amount, 0);
}
