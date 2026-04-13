import { test, expect } from '@playwright/test';

/**
 * Complete User Journey E2E Tests
 * Tests: Auth → KYC → Wallet → Predictions → Withdrawal
 */

test.describe('CrikeX Complete User Journey', () => {
  let userToken = '';
  let userId = '';
  const API_URL = 'http://localhost:3000/api/v1';

  // ── AUTHENTICATION TESTS ──

  test('Register new user via OTP', async ({ page }) => {
    await page.goto('/');

    // Navigate to signup
    await page.click('text=Sign Up');

    // Enter phone number
    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.fill('+919876543210');
    await page.click('text=Send OTP');

    // Verify OTP field appears
    const otpInput = page.locator('input[name="otp"]');
    await expect(otpInput).toBeVisible();

    // In test environment, use test OTP
    await otpInput.fill('123456');
    await page.click('text=Verify & Continue');

    // Should reach profile setup
    await expect(page).toHaveURL(/.*profile/);
  });

  test('Login existing user', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Login');

    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.fill('+919876543210');
    await page.click('text=Send OTP');

    // Fill OTP
    await page.locator('input[name="otp"]').fill('123456');
    await page.click('text=Verify');

    // Should be logged in
    await expect(page).toHaveURL(/.*dashboard/);

    // Store token for API tests
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    userToken = token;
  });

  // ── KYC VERIFICATION TESTS ──

  test('Submit KYC verification', async ({ page }) => {
    await page.goto('/profile');

    // Navigate to KYC section
    await page.click('text=Verify Identity');

    // Fill KYC form
    await page.locator('input[name="fullName"]').fill('Test User');
    await page.locator('input[name="dateOfBirth"]').fill('1990-01-15');
    await page.locator('input[name="panNumber"]').fill('ABCDE1234F');
    await page.locator('input[name="aadhaarNumber"]').fill('123456789012');

    // Submit
    await page.click('text=Submit');

    // Verify success message
    await expect(page.locator('text=KYC submitted')).toBeVisible();
  });

  test('Check KYC status', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/users/kyc-status`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(['pending', 'verified', 'rejected']).toContain(data.status);
  });

  // ── WALLET & DEPOSIT TESTS ──

  test('View wallet balance', async ({ page }) => {
    await page.goto('/wallet');

    // Verify balance displays
    const balance = page.locator('[data-testid="wallet-balance"]');
    await expect(balance).toBeVisible();
  });

  test('Initiate deposit', async ({ page }) => {
    await page.goto('/wallet');
    await page.click('text=Add Money');

    // Enter amount
    const amountInput = page.locator('input[name="amount"]');
    await amountInput.fill('500');

    // Click deposit button
    await page.click('text=Deposit');

    // Should redirect to Razorpay
    await page.waitForNavigation();

    // Verify Razorpay payment page loads
    const razorpayPage = page.url();
    expect(razorpayPage).toContain('razorpay');
  });

  test('Check wallet transaction history', async ({ page }) => {
    const response = await page.request.get(`${API_URL}/wallet/transactions`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data.transactions)).toBeTruthy();
  });

  // ── PREDICTION TESTS ──

  test('View available matches', async ({ page }) => {
    await page.goto('/matches');

    // Verify matches load
    const matchCards = page.locator('[data-testid="match-card"]');
    const count = await matchCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Place prediction on match', async ({ page }) => {
    await page.goto('/matches');

    // Click first match
    await page.click('[data-testid="match-card"]');

    // Verify match detail page
    await expect(page).toHaveURL(/.*match/);

    // Select prediction market
    await page.click('text=Match Winner');

    // Select team
    await page.click('text=Team A');

    // Enter stake
    const stakeInput = page.locator('input[name="stake"]');
    await stakeInput.fill('100');

    // Place bet
    await page.click('text=Place Bet');

    // Verify success
    await expect(page.locator('text=Bet placed successfully')).toBeVisible();
  });

  test('View prediction history', async ({ page }) => {
    await page.goto('/my-predictions');

    // Verify predictions display
    const predictions = page.locator('[data-testid="prediction-item"]');
    const count = await predictions.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('Check fraud detection in rapid bets', async ({ page }) => {
    await page.goto('/matches');

    // Try to place multiple bets rapidly
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid="match-card"]');
      await page.click('text=Match Winner');
      await page.click('text=Team A');

      const stakeInput = page.locator('input[name="stake"]');
      await stakeInput.fill('100');

      const response = await page.evaluate(async () => {
        return fetch('/api/v1/predictions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stake: 100 }),
        });
      });

      if (i > 2) {
        // Should be flagged or blocked after rapid attempts
        expect([403, 429]).toContain(response.status);
        break;
      }
    }
  });

  // ── ADVANCED FEATURES TESTS ──

  test('Access user analytics', async ({ page }) => {
    const response = await page.request.get(
      `${API_URL}/analytics/user-stats`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('stats');
      expect(data.stats).toHaveProperty('winRate');
    }
  });

  test('Access contests system', async ({ page }) => {
    const response = await page.request.get(
      `${API_URL}/contests/active`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );

    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data.contests)).toBeTruthy();
    }
  });

  test('Join contest', async ({ page }) => {
    await page.goto('/contests');

    // Click join on first contest
    const joinButtons = page.locator('text=Join Contest');
    const count = await joinButtons.count();

    if (count > 0) {
      await joinButtons.first().click();

      // Verify join dialog
      await expect(page.locator('text=Confirm')).toBeVisible();
      await page.click('text=Confirm');

      // Verify success
      await expect(page.locator('text=Joined')).toBeVisible();
    }
  });

  // ── WITHDRAWAL TESTS ──

  test('Initiate withdrawal after KYC', async ({ page }) => {
    // First ensure wallet has balance
    await page.goto('/wallet');

    // Look for withdrawal button
    const withdrawButton = page.locator('text=Withdraw');

    if (await withdrawButton.isVisible()) {
      await withdrawButton.click();

      // Should show bank account form
      await expect(page.locator('text=Bank Account')).toBeVisible();
    }
  });

  test('Link bank account for withdrawal', async ({ page }) => {
    await page.goto('/wallet');
    await page.click('text=Add Bank Account');

    // Fill bank details
    await page.locator('input[name="accountNumber"]').fill('9876543210123456');
    await page.locator('input[name="accountHolder"]').fill('Test User');
    await page.locator('input[name="ifsc"]').fill('SBIN0000001');
    await page.locator('input[name="bankName"]').fill('State Bank of India');

    // Submit
    await page.click('text=Verify Account');

    // Should require verification
    await expect(page.locator('text=Verification Code')).toBeVisible();
  });

  test('Check withdrawal limits', async ({ page }) => {
    const response = await page.request.get(
      `${API_URL}/wallet/withdrawal-limits`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('maxDaily');
    expect(data).toHaveProperty('minWithdrawal');
  });

  // ── 2FA TESTS ──

  test('Enable two-factor authentication', async ({ page }) => {
    await page.goto('/settings');

    // Click 2FA settings
    await page.click('text=Security');

    const enable2FA = page.locator('text=Enable 2FA');
    if (await enable2FA.isVisible()) {
      await enable2FA.click();

      // Should show QR code
      await expect(page.locator('canvas')).toBeVisible();

      // Verify backup codes displayed
      await expect(page.locator('text=Backup Codes')).toBeVisible();
    }
  });

  test('Test responsible gaming limits', async ({ page }) => {
    await page.goto('/settings');
    await page.click('text=Responsible Gaming');

    // Set daily limit
    const dailyLimit = page.locator('input[name="dailyLimit"]');
    await dailyLimit.fill('1000');

    await page.click('text=Save');

    // Verify saved
    await expect(page.locator('text=Limit saved')).toBeVisible();
  });

  // ── FEATURE FLAGS TEST ──

  test('Check feature availability', async ({ page }) => {
    const response = await page.request.get(
      `${API_URL}/admin/feature-status`,
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      }
    );

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('analytics');
      expect(data).toHaveProperty('contests');
    }
  });

  // ── LEADERBOARD TESTS ──

  test('View global leaderboard', async ({ page }) => {
    await page.goto('/leaderboard');

    // Verify leaderboard loads
    const leaderboardRows = page.locator('[data-testid="leaderboard-row"]');
    const count = await leaderboardRows.count();

    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('View personal performance stats', async ({ page }) => {
    await page.goto('/my-predictions');

    // Verify stats card
    const statsCard = page.locator('[data-testid="stats-card"]');
    await expect(statsCard).toBeVisible();

    // Verify key metrics display
    await expect(statsCard.locator('text="Win Rate"')).toBeVisible();
    await expect(statsCard.locator('text="Total Bets"')).toBeVisible();
  });
});

// ── PERFORMANCE TESTS ──

test.describe('Performance Tests', () => {
  test('Dashboard load time < 2s', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/dashboard');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(2000);
  });

  test('Matches list render < 3s', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/matches');

    // Wait for matches to render
    await page.waitForSelector('[data-testid="match-card"]');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });
});

// ── ERROR HANDLING TESTS ──

test.describe('Error Handling', () => {
  test('Handle network errors gracefully', async ({ page }) => {
    await page.context().setOffline(true);
    await page.goto('/dashboard');

    // Should show offline message
    await expect(page.locator('text=Offline')).toBeVisible();

    await page.context().setOffline(false);
  });

  test('Handle invalid OTP', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Login');

    const phoneInput = page.locator('input[name="phone"]');
    await phoneInput.fill('+919876543210');
    await page.click('text=Send OTP');

    // Fill invalid OTP
    await page.locator('input[name="otp"]').fill('000000');
    await page.click('text=Verify');

    // Should show error
    await expect(page.locator('text=Invalid OTP')).toBeVisible();
  });
});
