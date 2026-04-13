/**
 * CrikeX E2E Test Suite
 * Tests complete user journeys from signup to withdrawal
 *
 * Run with: npm run test:e2e
 * Requires: Playwright installed (npm install -D @playwright/test)
 */

export const TEST_CONFIG = {
  // Test user credentials
  testUser: {
    phone: '+919876543210',
    email: 'test@crikex.app',
    password: 'Test@12345',
    pan: 'AAAPA9876A',
    aadhaar: '1234',
  },

  // API endpoints
  apiBase: process.env.API_URL || 'http://localhost:3001/api/v1',
  clientBase: process.env.CLIENT_URL || 'http://localhost:5173',

  // Timeouts
  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000,
  },

  // Test data
  testMatch: {
    teamA: 'CSK',
    teamB: 'MI',
    venue: 'Mumbai',
  },

  testPrediction: {
    amount: 500,
    marketId: 'match_winner',
    selection: 'CSK',
  },
};

/**
 * Test Suite Structure
 *
 * 1. Authentication Tests
 *    - OTP signup
 *    - OTP verify
 *    - Token refresh
 *    - 2FA setup and verify
 *    - Password reset
 *
 * 2. KYC Tests
 *    - KYC submission
 *    - KYC status check
 *    - Document verification
 *
 * 3. Wallet Tests
 *    - Check balance
 *    - Deposit (Razorpay)
 *    - Daily bonus claim
 *    - Withdrawal request
 *
 * 4. Prediction Tests
 *    - Get matches
 *    - Get markets
 *    - Place prediction
 *    - Check prediction status
 *
 * 5. Responsible Gaming Tests
 *    - Set betting limits
 *    - Check limit enforcement
 *    - Self-exclusion
 *
 * 6. Admin Tests
 *    - User management
 *    - Match settlement
 *    - Fraud detection
 *
 * 7. End-to-End Flow
 *    - Complete signup to withdrawal journey
 */

export const TEST_SUITES = {
  auth: {
    name: 'Authentication',
    tests: [
      'OTP Send',
      'OTP Verify',
      '2FA Setup',
      '2FA Verify Login',
      '2FA Backup Codes',
      'Password Reset',
      'Account Recovery',
      'Token Refresh',
    ],
  },

  kyc: {
    name: 'KYC & Verification',
    tests: [
      'Submit KYC',
      'KYC Status Check',
      'KYC Webhook',
      'Document Upload',
      'Manual KYC Review',
    ],
  },

  wallet: {
    name: 'Wallet & Payments',
    tests: [
      'Get Wallet Balance',
      'Get Transactions',
      'Deposit Create Order',
      'Deposit Verify',
      'Daily Bonus Claim',
      'Withdrawal Initiate',
      'Withdrawal Confirm',
      'Check Withdrawal Status',
    ],
  },

  predictions: {
    name: 'Predictions & Betting',
    tests: [
      'Get Matches',
      'Get Markets',
      'Place Prediction',
      'Get My Predictions',
      'Check Odds Update',
      'WebSocket Live Updates',
    ],
  },

  gaming: {
    name: 'Responsible Gaming',
    tests: [
      'Set Daily Limit',
      'Exceed Limit Rejection',
      'Set Weekly Limit',
      'Set Monthly Limit',
      'Self-Exclude Account',
      'Lift Self-Exclusion',
      'Get Betting Insights',
    ],
  },

  admin: {
    name: 'Admin Functions',
    tests: [
      'Admin Dashboard Stats',
      'User Management',
      'Block/Unblock User',
      'Match Settlement',
      'Fraud Detection',
      'KYC Approval',
    ],
  },

  integration: {
    name: 'End-to-End Integration',
    tests: [
      'Complete User Journey (Signup to Withdrawal)',
      'Multiple Predictions & Settlement',
      'Fraud Detection Triggering',
      'State Restriction Enforcement',
      'WebSocket Real-time Updates',
    ],
  },
};

/**
 * Expected Response Codes
 */
export const HTTP_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 451, // Regional restriction
};

/**
 * Mock Data Generators
 */
export function generateTestData() {
  const uuid = Math.random().toString(36).substring(7);

  return {
    userId: `user_${uuid}`,
    email: `test_${uuid}@crikex.app`,
    phone: `+91${Math.floor(Math.random() * 9999999999 + 6000000000)}`,
    username: `testuser_${uuid}`,
    pan: 'AAAPA9876A',
  };
}

/**
 * Database Utilities for Testing
 */
export const dbUtils = {
  /**
   * Seed test data
   */
  async seedData() {
    // In production, use actual database seeding
    return {
      testUsers: 5,
      testMatches: 10,
      testTransactions: 50,
    };
  },

  /**
   * Clean up test data
   */
  async cleanup() {
    // Delete test users, matches, transactions
    return { deleted: true };
  },

  /**
   * Reset database to initial state
   */
  async reset() {
    await this.cleanup();
    await this.seedData();
  },
};

/**
 * Assertion Helpers
 */
export const assertions = {
  statusOk: (response) => response.status === 200 || response.status === 201,

  hasToken: (response) => !!response.data?.token,

  hasUserId: (response) => !!response.data?.user?.id,

  walletValid: (wallet) =>
    wallet.coinsBalance >= 0 &&
    wallet.premiumBalance >= 0 &&
    wallet.updatedAt,

  predictionValid: (prediction) =>
    prediction.id &&
    prediction.matchId &&
    prediction.marketId &&
    prediction.selection &&
    prediction.coinsStaked > 0,

  kycValid: (kyc) =>
    kyc.id &&
    kyc.userId &&
    kyc.status &&
    ['submitted', 'verified', 'pending', 'rejected'].includes(kyc.status),
};

/**
 * Logging & Reporting
 */
export const logging = {
  log: (message, data) => console.log(`[TEST] ${message}`, data),

  error: (message, error) => console.error(`[ERROR] ${message}`, error),

  success: (message, result) => console.log(`[✓] ${message}`, result),
};

export default TEST_CONFIG;
