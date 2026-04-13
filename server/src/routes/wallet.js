import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { withdrawalAuthMiddleware, withdrawalLimitsMiddleware, bankAccountVerificationMiddleware } from '../middleware/withdrawalAuth.js';
import { getWallet, getTransactions, claimDailyBonus, createPaymentRecord, updatePaymentStatus, creditDeposit } from '../services/nhostClient.js';
import { createOrder, verifySignature } from '../services/razorpay.js';
import { createWithdrawalRequest, processWithdrawal, calculateTDS, verifyBankAccount, getWithdrawalLimits } from '../services/withdrawalProvider.js';
import { WALLET } from '../config/constants.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(authMiddleware);

// GET /api/v1/wallet
router.get('/', async (req, res) => {
  try {
    const wallet = await getWallet(req.user.id);
    if (!wallet) return res.status(404).json({ error: 'WALLET_NOT_FOUND' });
    
    res.json({ success: true, wallet: {
      coinsBalance: wallet.coins_balance,
      premiumBalance: wallet.premium_balance,
      updatedAt: wallet.updated_at
    }});
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

// GET /api/v1/wallet/transactions
router.get('/transactions', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = (page - 1) * limit;

  try {
    const data = await getTransactions(req.user.id, limit, offset);
    const txns = data.wallet_transactions || [];
    const total = data.wallet_transactions_aggregate?.aggregate?.count || 0;
    
    res.json({ 
      success: true, 
      transactions: txns, 
      total, 
      page, 
      totalPages: Math.ceil(total / limit) 
    });
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

// POST /api/v1/wallet/claim-daily
router.post('/claim-daily', async (req, res) => {
  try {
    const message = await claimDailyBonus(req.user.id, WALLET.DAILY_LOGIN_BONUS);
    
    // get updated balance
    const wallet = await getWallet(req.user.id);
    
    res.json({ 
      success: true, 
      bonus: WALLET.DAILY_LOGIN_BONUS, 
      newBalance: wallet?.coins_balance, 
      message 
    });
  } catch (err) {
    res.status(400).json({ error: 'ALREADY_CLAIMED', message: err.message });
  }
});

// POST /api/v1/wallet/deposit/create-order
router.post('/deposit/create-order', async (req, res) => {
  const { amount } = req.body; // Amount in INR
  if (!amount || amount < 10) return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Minimum deposit is ₹10' });

  try {
    const order = await createOrder(amount, 'INR', `rcpt_${req.user.id.slice(0, 8)}`);
    // Save to Nhost DB tracking payments
    await createPaymentRecord(req.user.id, order.id, amount);
    
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: 'PAYMENT_ERROR', message: err.message });
  }
});

// POST /api/v1/wallet/deposit/verify
router.post('/deposit/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'MISSING_PAYMENT_DETAILS' });
  }

  try {
    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      await updatePaymentStatus(razorpay_order_id, razorpay_payment_id, razorpay_signature, 'failed');
      return res.status(400).json({ error: 'INVALID_SIGNATURE' });
    }

    // Update payment record
    const payment = await updatePaymentStatus(razorpay_order_id, razorpay_payment_id, razorpay_signature, 'paid');
    
    if (payment.update_razorpay_payments.returning.length === 0) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }

    // Credit coins to wallet (1 INR = 10 Coins)
    const amountInr = payment.update_razorpay_payments.returning[0].amount;
    const coinsToCredit = amountInr * 10;
    
    const { newBalance } = await creditDeposit(req.user.id, coinsToCredit, razorpay_order_id);
    
    res.json({ success: true, coinsCredited: coinsToCredit, newBalance });
  } catch (err) {
    res.status(500).json({ error: 'DEPOSIT_FAILED', message: err.message });
  }
});

// ── WITHDRAWAL ROUTES ──

// POST /api/v1/wallet/bank-account/verify
// Verify bank account with micro-deposit
router.post('/bank-account/verify', withdrawalAuthMiddleware, bankAccountVerificationMiddleware, async (req, res) => {
  try {
    const { bankAccount, ifscCode, accountHolderName } = req.body;

    const result = await verifyBankAccount({
      accountNumber: bankAccount,
      ifscCode,
      accountHolderName,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error, message: result.message });
    }

    logger.info('Bank account verification initiated', {
      userId: req.user.id,
      account: `****${bankAccount.slice(-4)}`,
    });

    res.json({
      success: true,
      status: result.status,
      message: result.message,
      verificationRequired: result.verificationRequired,
    });
  } catch (err) {
    logger.error('Bank verification error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'VERIFICATION_ERROR', message: err.message });
  }
});

// POST /api/v1/wallet/withdrawal/initiate
// Create withdrawal request
router.post(
  '/withdrawal/initiate',
  withdrawalAuthMiddleware,
  withdrawalLimitsMiddleware,
  bankAccountVerificationMiddleware,
  async (req, res) => {
    try {
      const { amount, bankAccount, accountHolderName } = req.body;

      // Get current wallet balance
      const wallet = await getWallet(req.user.id);
      if (!wallet) {
        return res.status(404).json({ error: 'WALLET_NOT_FOUND' });
      }

      const availableCoins = wallet.coins_balance;

      // Create withdrawal request
      const result = await createWithdrawalRequest(req.user.id, { amount, bankAccount, accountHolderName }, availableCoins);

      if (!result.success) {
        return res.status(400).json({ error: result.error, message: result.message });
      }

      logger.info('Withdrawal request created', {
        userId: req.user.id,
        withdrawalId: result.withdrawal.id,
        amount,
      });

      res.status(201).json({
        success: true,
        withdrawal: result.withdrawal,
        message: result.message,
      });
    } catch (err) {
      logger.error('Withdrawal initiation error', { userId: req.user.id, error: err.message });
      res.status(500).json({ error: 'WITHDRAWAL_ERROR', message: err.message });
    }
  }
);

// POST /api/v1/wallet/withdrawal/confirm
// Confirm withdrawal and deduct from wallet
router.post('/withdrawal/confirm', withdrawalAuthMiddleware, async (req, res) => {
  try {
    const { withdrawalId } = req.body;

    if (!withdrawalId) {
      return res.status(400).json({ error: 'MISSING_WITHDRAWAL_ID' });
    }

    // Get wallet
    const wallet = await getWallet(req.user.id);
    if (!wallet) {
      return res.status(404).json({ error: 'WALLET_NOT_FOUND' });
    }

    // In production, this would:
    // 1. Deduct amount from wallet
    // 2. Create transaction record
    // 3. Call Razorpay Settlements API to process payout
    // 4. Return payout reference

    logger.info('Withdrawal confirmed', {
      userId: req.user.id,
      withdrawalId,
    });

    res.json({
      success: true,
      message: 'Withdrawal confirmed. Amount will be credited in 1-2 business days.',
      withdrawalId,
    });
  } catch (err) {
    logger.error('Withdrawal confirmation error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'CONFIRMATION_ERROR', message: err.message });
  }
});

// GET /api/v1/wallet/withdrawals
// Get withdrawal history
router.get('/withdrawals', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    // In production, query from database
    // For now, return empty array
    const withdrawals = [];

    res.json({
      success: true,
      withdrawals,
      page,
      total: 0,
      totalPages: 0,
    });
  } catch (err) {
    logger.error('Withdrawal history error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'DB_ERROR', message: err.message });
  }
});

// GET /api/v1/wallet/withdrawal-limits
// Get withdrawal limits for current user
router.get('/withdrawal-limits', withdrawalAuthMiddleware, (req, res) => {
  try {
    const user = req.user;
    const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

    const dailyLimit = getWithdrawalLimits(user.kycStatus, accountAgeDays);

    res.json({
      success: true,
      limits: {
        daily: dailyLimit,
        minimum: 100,
        maximum: 100000,
        fee: '2%',
        tdsRate: '30%',
      },
      message: `Your daily withdrawal limit is ₹${dailyLimit}`,
    });
  } catch (err) {
    logger.error('Withdrawal limits error', { userId: req.user.id, error: err.message });
    res.status(500).json({ error: 'ERROR', message: err.message });
  }
});

// POST /api/v1/wallet/calculate-tds
// Calculate TDS for withdrawal
router.post('/calculate-tds', withdrawalAuthMiddleware, (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    const tdsCalc = calculateTDS(amount);

    res.json({ success: true, ...tdsCalc });
  } catch (err) {
    res.status(500).json({ error: 'CALCULATION_ERROR', message: err.message });
  }
});

export default router;
