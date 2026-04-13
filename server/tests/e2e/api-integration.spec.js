import { test, expect } from '@playwright/test';

/**
 * API Integration Tests
 * Direct API endpoint testing with full request/response validation
 */

const API_URL = 'http://localhost:3000/api/v1';

test.describe('API Integration Tests', () => {
  let authToken = '';

  // Setup: Create test user
  test.beforeAll(async () => {
    // In real scenario, create test user via API
    // For now, using mock token
    authToken = 'test-token';
  });

  // ── AUTHENTICATION API ──

  test('POST /auth/send-otp - Send OTP', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/send-otp`, {
      data: {
        phone: '+919876543210',
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('requestId');
  });

  test('POST /auth/verify-otp - Verify OTP', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/verify-otp`, {
      data: {
        phone: '+919876543210',
        otp: '123456',
      },
    });

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('token');
      authToken = data.token;
    }
  });

  // ── USER ROUTES ──

  test('GET /users/profile - Get user profile', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('user');
    }
  });

  test('POST /users/accept-terms - Accept terms', async ({ request }) => {
    const response = await request.post(`${API_URL}/users/accept-terms`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        version: '1.0',
      },
    });

    expect([200, 400]).toContain(response.status());
  });

  test('POST /users/accept-privacy - Accept privacy policy', async ({ request }) => {
    const response = await request.post(
      `${API_URL}/users/accept-privacy`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          version: '1.0',
        },
      }
    );

    expect([200, 400]).toContain(response.status());
  });

  // ── KYC ROUTES ──

  test('POST /users/kyc - Submit KYC', async ({ request }) => {
    const response = await request.post(`${API_URL}/users/kyc`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        fullName: 'Test User',
        dateOfBirth: '1990-01-15',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123456789012',
      },
    });

    expect([200, 201, 400]).toContain(response.status());
  });

  test('GET /users/kyc-status - Check KYC status', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/kyc-status`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(['pending', 'verified', 'rejected']).toContain(data.status);
  });

  // ── 2FA ROUTES ──

  test('POST /auth/2fa/setup - Setup 2FA', async ({ request }) => {
    const response = await request.post(`${API_URL}/auth/2fa/setup`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect([200, 400]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('secret');
      expect(data).toHaveProperty('backupCodes');
    }
  });

  test('GET /auth/2fa/status - Check 2FA status', async ({ request }) => {
    const response = await request.get(`${API_URL}/auth/2fa/status`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('enabled');
  });

  // ── WALLET ROUTES ──

  test('GET /wallet - Get wallet balance', async ({ request }) => {
    const response = await request.get(`${API_URL}/wallet`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('balance');
    expect(typeof data.balance).toBe('number');
  });

  test('GET /wallet/transactions - Get transaction history', async ({ request }) => {
    const response = await request.get(`${API_URL}/wallet/transactions`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data.transactions)).toBeTruthy();
  });

  test('POST /wallet/bank-account/verify - Verify bank account', async ({
    request,
  }) => {
    const response = await request.post(
      `${API_URL}/wallet/bank-account/verify`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          accountNumber: '9876543210123456',
          accountHolder: 'Test User',
          ifsc: 'SBIN0000001',
        },
      }
    );

    expect([200, 400, 403]).toContain(response.status());
  });

  test('GET /wallet/withdrawal-limits - Get withdrawal limits', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/wallet/withdrawal-limits`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect([200, 403]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('maxDaily');
      expect(data).toHaveProperty('minWithdrawal');
    }
  });

  test('POST /wallet/calculate-tds - Calculate TDS', async ({ request }) => {
    const response = await request.post(`${API_URL}/wallet/calculate-tds`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        winningAmount: 50000,
      },
    });

    expect([200, 400, 403]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('tdsAmount');
      expect(data).toHaveProperty('netAmount');
    }
  });

  // ── PREDICTIONS ROUTES ──

  test('GET /predictions/available - Get available matches', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/predictions/available`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data.matches)).toBeTruthy();
  });

  test('POST /predictions - Place prediction', async ({ request }) => {
    const response = await request.post(`${API_URL}/predictions`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        matchId: 'match-1',
        market: 'match_winner',
        selection: 'team_a',
        odds: 2.5,
        stake: 100,
      },
    });

    expect([201, 400, 403, 429]).toContain(response.status());
  });

  test('GET /predictions/history - Get prediction history', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/predictions/history`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data.predictions)).toBeTruthy();
  });

  // ── ANALYTICS ROUTES ──

  test('GET /analytics/user-stats - Get user statistics', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/analytics/user-stats`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('totalBets');
      expect(data.stats).toHaveProperty('winRate');
      expect(data.stats).toHaveProperty('roi');
    }
  });

  test('GET /analytics/performance-trend - Get performance trends', async ({
    request,
  }) => {
    const response = await request.get(
      `${API_URL}/analytics/performance-trend?days=30`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data.trend)).toBeTruthy();
    }
  });

  test('GET /analytics/recommendations - Get recommendations', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/analytics/recommendations`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data.recommendations)).toBeTruthy();
    }
  });

  // ── CONTESTS ROUTES ──

  test('GET /contests/active - Get active contests', async ({ request }) => {
    const response = await request.get(`${API_URL}/contests/active`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data.contests)).toBeTruthy();
    }
  });

  test('POST /contests/create - Create new contest', async ({ request }) => {
    const response = await request.post(`${API_URL}/contests/create`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        name: 'Test Contest',
        matches: [{ id: 'match-1' }, { id: 'match-2' }],
        entryFee: 100,
        maxParticipants: 1000,
        prizePool: 50000,
      },
    });

    expect([201, 400, 403]).toContain(response.status());
  });

  test('POST /contests/:id/join - Join contest', async ({ request }) => {
    const response = await request.post(`${API_URL}/contests/test-contest/join`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        entryFee: 100,
      },
    });

    expect([200, 400, 403, 404]).toContain(response.status());
  });

  // ── LEADERBOARD ROUTES ──

  test('GET /leaderboard - Get global leaderboard', async ({ request }) => {
    const response = await request.get(`${API_URL}/leaderboard`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data.leaderboard)).toBeTruthy();
  });

  // ── ADMIN ROUTES ──

  test('GET /admin/feature-status - Check feature flags', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/admin/feature-status`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect([200, 403]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('analytics');
      expect(data).toHaveProperty('contests');
    }
  });

  // ── HEALTH CHECK ──

  test('GET /health - Health check endpoint', async ({ request }) => {
    const response = await request.get(
      'http://localhost:3000/api/health'
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
  });
});

// ── ERROR HANDLING ──

test.describe('API Error Handling', () => {
  test('401 - Unauthorized access without token', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/profile`);

    expect(response.status()).toBe(401);
  });

  test('403 - Forbidden access with invalid token', async ({ request }) => {
    const response = await request.get(`${API_URL}/users/profile`, {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('404 - Not found error', async ({ request }) => {
    const response = await request.get(`${API_URL}/invalid-endpoint`);

    expect(response.status()).toBe(404);
  });

  test('429 - Rate limit exceeded', async ({ request }) => {
    // Make multiple rapid requests
    const requests = [];
    for (let i = 0; i < 100; i++) {
      requests.push(
        request.post(`${API_URL}/auth/send-otp`, {
          data: { phone: '+919876543210' },
        })
      );
    }

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status() === 429);

    expect(rateLimited).toBeTruthy();
  });
});
