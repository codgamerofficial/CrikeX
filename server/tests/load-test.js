import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * CrikeX Load Testing Suite
 *
 * Run with:
 * k6 run server/tests/load-test.js
 *
 * With custom settings:
 * k6 run --vus 100 --duration 60s server/tests/load-test.js
 */

const API_BASE = __ENV.API_URL || 'http://localhost:3001/api/v1';
const CLIENT_BASE = __ENV.CLIENT_URL || 'http://localhost:5173';

// Custom metrics
const authErrorRate = new Rate('auth_errors');
const predictionErrorRate = new Rate('prediction_errors');
const withdrawalErrorRate = new Rate('withdrawal_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10, name: 'ramp-up' },
    { duration: '1m30s', target: 50, name: 'stress' },
    { duration: '20s', target: 100, name: 'spike' },
    { duration: '30s', target: 10, name: 'ramp-down' },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'], // error rate < 10%
    auth_errors: ['rate<0.05'],
    prediction_errors: ['rate<0.1'],
    withdrawal_errors: ['rate<0.05'],
  },
};

// Test data
const testUsers = {
  user1: { phone: '+919876543210', email: 'user1@test.com', password: 'Test@12345' },
  user2: { phone: '+919876543211', email: 'user2@test.com', password: 'Test@12345' },
  user3: { phone: '+919876543212', email: 'user3@test.com', password: 'Test@12345' },
};

const matches = [
  { id: 'match1', teamA: 'CSK', teamB: 'MI' },
  { id: 'match2', teamA: 'RCB', teamB: 'KKR' },
  { id: 'match3', teamA: 'DC', teamB: 'SRH' },
];

/**
 * Setup: Run once before all tests
 */
export function setup() {
  console.log('=== CrikeX Load Test Starting ===');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Client Base: ${CLIENT_BASE}`);

  return {
    authToken: null,
    userId: null,
  };
}

/**
 * Authentication Tests
 */
function testAuthentication() {
  return group('Authentication', () => {
    const user = testUsers.user1;

    // Send OTP
    let sendOtpRes = http.post(`${API_BASE}/auth/send-otp`, {
      phone: user.phone,
    });

    let isSuccess = check(sendOtpRes, {
      'send-otp status 200': (r) => r.status === 200,
      'send-otp has otpRef': (r) => r.json().otpRef !== undefined,
    });

    authErrorRate.add(!isSuccess);

    if (!isSuccess) return null;

    const otpRef = sendOtpRes.json().otpRef;

    // Mock OTP verification (in real scenario, you'd extract from email/SMS)
    const otp = '123456'; // Mock OTP

    let verifyOtpRes = http.post(`${API_BASE}/auth/verify-otp`, {
      otpRef,
      otp,
      stateCode: 'IN-MH',
    });

    isSuccess = check(verifyOtpRes, {
      'verify-otp status 200': (r) => r.status === 200,
      'verify-otp has token': (r) => r.json().token !== undefined,
    });

    authErrorRate.add(!isSuccess);

    return {
      token: verifyOtpRes.json().token || null,
      userId: verifyOtpRes.json().user?.id || null,
    };
  });
}

/**
 * KYC Tests
 */
function testKYC(token) {
  return group('KYC Verification', () => {
    const kycData = {
      panNumber: 'AAAPA9876A',
      aadhaarLast4: '1234',
      fullName: 'John Doe',
      dob: '1990-01-01',
    };

    let submitRes = http.post(`${API_BASE}/users/kyc`, kycData, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let isSuccess = check(submitRes, {
      'kyc-submit status 201': (r) => r.status === 201,
      'kyc-submit has record': (r) => r.json().kyc !== undefined,
    });

    if (!isSuccess) return;

    // Check KYC status
    sleep(1);

    let statusRes = http.get(`${API_BASE}/users/kyc/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(statusRes, {
      'kyc-status status 200': (r) => r.status === 200,
      'kyc-status has record': (r) => r.json().record !== undefined,
    });
  });
}

/**
 * Wallet Tests
 */
function testWallet(token) {
  return group('Wallet Operations', () => {
    // Get balance
    let balanceRes = http.get(`${API_BASE}/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let isSuccess = check(balanceRes, {
      'wallet-balance status 200': (r) => r.status === 200,
      'wallet-balance has coins': (r) => r.json().wallet?.coinsBalance >= 0,
    });

    if (!isSuccess) return;

    // Get transactions
    let txRes = http.get(`${API_BASE}/wallet/transactions`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(txRes, {
      'wallet-transactions status 200': (r) => r.status === 200,
      'wallet-transactions is array': (r) => Array.isArray(r.json().transactions),
    });

    // Claim daily bonus
    let bonusRes = http.post(`${API_BASE}/wallet/claim-daily`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(bonusRes, {
      'wallet-bonus status 200': (r) => [200, 400].includes(r.status), // 400 if already claimed
      'wallet-bonus has message': (r) => r.json().message !== undefined,
    });
  });
}

/**
 * Prediction Tests (High Load)
 */
function testPredictions(token) {
  return group('Predictions', () => {
    const match = matches[Math.floor(Math.random() * matches.length)];

    // Place prediction
    let predRes = http.post(`${API_BASE}/predictions`, {
      matchId: match.id,
      marketId: 'match_winner',
      selection: match.teamA,
      coins: Math.floor(Math.random() * (5000 - 100 + 1)) + 100, // 100-5000
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let isSuccess = check(predRes, {
      'prediction-place status 201': (r) => r.status === 201,
      'prediction-place has id': (r) => r.json().prediction?.id !== undefined,
    });

    predictionErrorRate.add(!isSuccess);

    if (!isSuccess) return;

    // Get my predictions
    sleep(0.5);

    let myPredRes = http.get(`${API_BASE}/predictions/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(myPredRes, {
      'prediction-list status 200': (r) => r.status === 200,
      'prediction-list is array': (r) => Array.isArray(r.json().predictions),
    });
  });
}

/**
 * 2FA Tests
 */
function test2FA(token) {
  return group('2FA Setup', () => {
    // Setup 2FA
    let setupRes = http.post(`${API_BASE}/auth/2fa/setup`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let isSuccess = check(setupRes, {
      '2fa-setup status 200': (r) => r.status === 200,
      '2fa-setup has secret': (r) => r.json().secret !== undefined,
    });

    if (!isSuccess) return;

    // Get 2FA status
    let statusRes = http.get(`${API_BASE}/auth/2fa/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(statusRes, {
      '2fa-status status 200': (r) => r.status === 200,
      '2fa-status has enabled': (r) => r.json().twoFactorAuth?.enabled !== undefined,
    });
  });
}

/**
 * Withdrawal Tests
 */
function testWithdrawal(token) {
  return group('Withdrawal Process', () => {
    // Get withdrawal limits
    let limitsRes = http.get(`${API_BASE}/wallet/withdrawal-limits`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let isSuccess = check(limitsRes, {
      'withdrawal-limits status 200': (r) => r.status === 200,
      'withdrawal-limits has daily': (r) => r.json().limits?.daily > 0,
    });

    withdrawalErrorRate.add(!isSuccess);

    if (!isSuccess) return;

    // Calculate TDS
    let tdsRes = http.post(`${API_BASE}/wallet/calculate-tds`, {
      amount: 10000,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(tdsRes, {
      'withdrawal-tds status 200': (r) => r.status === 200,
      'withdrawal-tds has calculation': (r) => r.json().tdsAmount !== undefined,
    });

    // Verify bank account
    let bankRes = http.post(`${API_BASE}/wallet/bank-account/verify`, {
      bankAccount: '1234567890123456',
      ifscCode: 'SBIN0001234',
      accountHolderName: 'John Doe',
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(bankRes, {
      'withdrawal-bank status 200': (r) => r.status === 200,
    });
  });
}

/**
 * Responsible Gaming Tests
 */
function testResponsibleGaming(token) {
  return group('Responsible Gaming', () => {
    // Get responsible gaming report
    let reportRes = http.get(`${API_BASE}/users/responsible-gaming-report`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(reportRes, {
      'rg-report status 200': (r) => r.status === 200,
      'rg-report has limits': (r) => r.json().limits !== undefined,
    });
  });
}

/**
 * WebSocket Test (Simulated via polling)
 */
function testWebSocket() {
  return group('Real-time Updates', () => {
    const match = matches[0];

    let liveRes = http.get(`${API_BASE}/matches/${match.id}`, {
      headers: { 'Accept': 'application/json' },
    });

    check(liveRes, {
      'live-data status 200': (r) => r.status === 200,
      'live-data has score': (r) => r.json().match?.scoreData !== undefined,
    });
  });
}

/**
 * Main Test Function
 */
export default function (data) {
  // Test 1: Authentication
  const authData = testAuthentication();
  if (!authData || !authData.token) {
    console.log('Authentication failed, exiting test');
    return;
  }

  const token = authData.token;
  sleep(1);

  // Test 2: KYC
  testKYC(token);
  sleep(1);

  // Test 3: Wallet
  testWallet(token);
  sleep(1);

  // Test 4: Predictions (High concurrency)
  for (let i = 0; i < 3; i++) {
    testPredictions(token);
    sleep(Math.random() * 2); // 0-2 second random delay
  }

  // Test 5: 2FA
  test2FA(token);
  sleep(1);

  // Test 6: Withdrawal
  testWithdrawal(token);
  sleep(1);

  // Test 7: Responsible Gaming
  testResponsibleGaming(token);
  sleep(1);

  // Test 8: WebSocket/Real-time
  testWebSocket();
  sleep(1);
}

/**
 * Teardown: Run once after all tests complete
 */
export function teardown(data) {
  console.log('=== CrikeX Load Test Complete ===');
}

/**
 * Thresholds Summary:
 * - API response time p95 < 500ms
 * - API response time p99 < 1000ms
 * - Overall error rate < 10%
 * - Auth error rate < 5%
 * - Prediction error rate < 10%
 * - Withdrawal error rate < 5%
 */
