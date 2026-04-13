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
 * Initiate KYC verification with Razorpay
 * This creates a verification link for the user to complete their KYC
 */
export async function initiateKYCVerification(user) {
  try {
    // Create an account for the user in Razorpay's KYC system
    const response = await razorpayAPI.post('/accounts', {
      email: user.email || `user_${user.id}@crikex.app`,
      phone: user.phone,
      type: 'individual',
      legal_info: {
        pan: user.pan,
      },
      notes: {
        user_id: user.id,
        username: user.username,
      },
    });

    const accountId = response.data.id;

    logger.info('KYC verification initiated', { userId: user.id, accountId });

    return {
      success: true,
      accountId,
      status: 'pending',
      redirectUrl: `https://dashboard.razorpay.com/accounts/${accountId}/verification`,
    };
  } catch (error) {
    logger.error('KYC verification initiation failed', {
      userId: user.id,
      error: error.response?.data || error.message,
    });

    // Fallback to manual verification
    return {
      success: false,
      error: 'KYC_INITIATION_FAILED',
      message: 'Unable to initiate KYC. Please try again or contact support.',
    };
  }
}

/**
 * Check KYC status for a user
 */
export async function checkKYCStatus(accountId) {
  try {
    const response = await razorpayAPI.get(`/accounts/${accountId}`);
    const account = response.data;

    // Map Razorpay status to our status
    const statusMap = {
      active: 'verified',
      suspended: 'rejected',
      processing: 'submitted',
      rejected: 'rejected',
    };

    return {
      success: true,
      status: statusMap[account.status] || 'pending',
      razorpayStatus: account.status,
      verificationDetails: {
        pan: account.legal_info?.pan,
        email: account.email,
        phone: account.phone,
      },
    };
  } catch (error) {
    logger.error('KYC status check failed', { accountId, error: error.message });

    return {
      success: false,
      error: 'STATUS_CHECK_FAILED',
    };
  }
}

/**
 * Submit KYC documents
 * In production, documents are verified through Razorpay's system
 */
export async function submitKYCDocuments(userId, documents) {
  try {
    // Documents would be uploaded to Razorpay's verification system
    // For now, we return a pending status
    logger.info('KYC documents submitted', { userId, documentCount: documents.length });

    return {
      success: true,
      status: 'submitted',
      message: 'Documents submitted for verification',
    };
  } catch (error) {
    logger.error('Document submission failed', { userId, error: error.message });

    return {
      success: false,
      error: 'DOCUMENT_SUBMISSION_FAILED',
    };
  }
}

/**
 * Webhook handler for Razorpay KYC status updates
 * This is called when Razorpay updates the KYC status
 */
export async function handleKYCWebhook(webhookData) {
  try {
    const { account_id, status, reason } = webhookData;

    logger.info('KYC webhook received', { accountId: account_id, status, reason });

    return {
      success: true,
      accountId: account_id,
      status,
      reason,
    };
  } catch (error) {
    logger.error('Webhook processing failed', { error: error.message });
    return {
      success: false,
      error: 'WEBHOOK_PROCESSING_FAILED',
    };
  }
}

/**
 * Manual KYC verification fallback
 * Used when Razorpay integration is unavailable
 * In production, this would queue for manual admin review
 */
export async function submitManualKYC(userId, kycData) {
  try {
    const record = {
      userId,
      status: 'pending_review',
      submittedAt: new Date(),
      data: {
        pan: `XXXX${kycData.panNumber.slice(-4)}`,
        aadhaarLast4: kycData.aadhaarLast4 || '****',
        fullName: kycData.fullName,
        dob: kycData.dob,
      },
    };

    logger.info('Manual KYC record created', { userId, status: record.status });

    return {
      success: true,
      status: 'pending_review',
      message: 'KYC submitted for manual review',
      record,
    };
  } catch (error) {
    logger.error('Manual KYC submission failed', { userId, error: error.message });

    return {
      success: false,
      error: 'MANUAL_KYC_FAILED',
    };
  }
}

/**
 * Get eligible withdrawal limit based on KYC status
 */
export function getWithdrawalLimitByKYCStatus(kycStatus) {
  const limits = {
    verified: 100000, // ₹1,00,000
    submitted: 10000, // ₹10,000 (unverified limit)
    pending: 5000, // ₹5,000 (minimal limit)
    rejected: 0, // Cannot withdraw
  };

  return limits[kycStatus] || 0;
}
