# CrikeX API Reference - New Endpoints

## Authentication & Account Management

### 2FA (Two-Factor Authentication)

#### Setup 2FA
```
POST /api/v1/auth/2fa/setup
Headers: Authorization: Bearer <token>
Response: { secret, qrCode, backupCodes, manualEntryKey }
```

#### Verify 2FA Setup
```
POST /api/v1/auth/2fa/verify-setup
Body: { token: "123456", secret: "...", backupCodes: [...] }
Response: { success, backupCodes, backupMessage }
```

#### Verify 2FA During Login
```
POST /api/v1/auth/2fa/verify-login
Body: { userId: "...", token: "123456" OR "BACKUPCODE" }
Response: { success, token: <jwt> }
```

#### Get 2FA Status
```
GET /api/v1/auth/2fa/status
Headers: Authorization: Bearer <token>
Response: { enabled, backupCodesRemaining, lastUsed }
```

#### Disable 2FA
```
POST /api/v1/auth/2fa/disable
Headers: Authorization: Bearer <token>
Body: { passwordConfirmed: true }
```

#### Regenerate Backup Codes
```
POST /api/v1/auth/2fa/regenerate-backup-codes
Headers: Authorization: Bearer <token>
Response: { backupCodes, message }
```

### Password Recovery

#### Initiate Password Reset
```
POST /api/v1/auth/forgot-password
Body: { email: "user@crikex.app" }
Response: { success, message } (doesn't reveal if email exists)
```

#### Verify Recovery Token
```
POST /api/v1/auth/verify-recovery-token
Body: { token: "..." }
Response: { valid, email, expiresAt, timeRemaining }
```

#### Reset Password
```
POST /api/v1/auth/reset-password
Body: { token: "...", newPassword: "...", confirmPassword: "..." }
Response: { success, message, redirectTo: "/login" }
```

#### Send Email Verification Code
```
POST /api/v1/auth/send-email-verification
Headers: Authorization: Bearer <token>
Body: { email: "...", purpose: "email_verification" }
Response: { success, message }
```

#### Verify Email Code
```
POST /api/v1/auth/verify-email-code
Body: { email: "...", code: "123456" }
Response: { success, message, verifiedAt }
```

#### Get Recovery Requirements
```
GET /api/v1/auth/recovery-requirements/:kycStatus
Response: { kycStatus, requirements: { methods, required, timeToProcess } }
```

---

## KYC Verification

#### Submit KYC
```
POST /api/v1/users/kyc
Headers: Authorization: Bearer <token>
Body: { panNumber: "AAAPA1234A", aadhaarLast4: "1234", fullName: "...", dob: "1990-01-01" }
Response: { success, kyc: {...}, message }
```

#### Get KYC Status
```
GET /api/v1/users/kyc/status
Headers: Authorization: Bearer <token>
Response: { success, kycStatus: "verified|submitted|pending|rejected", record }
```

#### KYC Webhook (Razorpay)
```
POST /api/v1/users/kyc/webhook
Body: { account_id: "...", status: "active|rejected|processing" }
Response: { success, updated: true/false }
```

---

## Policy Acceptance

#### Accept Terms
```
POST /api/v1/users/accept-terms
Headers: Authorization: Bearer <token>
Body: { version: "1.0" }
Response: { success, acceptedAt }
```

#### Accept Privacy Policy
```
POST /api/v1/users/accept-privacy
Headers: Authorization: Bearer <token>
Body: { version: "1.0" }
Response: { success, acceptedAt }
```

#### Get Acceptance Status
```
GET /api/v1/users/acceptance-status
Headers: Authorization: Bearer <token>
Response: { accepted: { terms, privacy }, versions, history }
```

---

## Wallet & Withdrawals

#### Verify Bank Account
```
POST /api/v1/wallet/bank-account/verify
Headers: Authorization: Bearer <token>
Body: { bankAccount: "1234567890", ifscCode: "SBIN0001234", accountHolderName: "John Doe" }
Response: { success, status: "pending_verification", message }
```

#### Initiate Withdrawal
```
POST /api/v1/wallet/withdrawal/initiate
Headers: Authorization: Bearer <token>
Body: { amount: 1000, bankAccount: "1234567890", accountHolderName: "John Doe" }
Response: { success, withdrawal: {...}, message }
```

#### Confirm Withdrawal
```
POST /api/v1/wallet/withdrawal/confirm
Headers: Authorization: Bearer <token>
Body: { withdrawalId: "wd_..." }
Response: { success, message, withdrawalId }
```

#### Get Withdrawal History
```
GET /api/v1/wallet/withdrawals?page=1&limit=20
Headers: Authorization: Bearer <token>
Response: { success, withdrawals: [...], page, total, totalPages }
```

#### Get Withdrawal Limits
```
GET /api/v1/wallet/withdrawal-limits
Headers: Authorization: Bearer <token>
Response: { success, limits: { daily, minimum, maximum, fee, tdsRate }, message }
```

#### Calculate TDS
```
POST /api/v1/wallet/calculate-tds
Headers: Authorization: Bearer <token>
Body: { amount: 10000 }
Response: { success, grossAmount, tdsAmount, netAmount, tdsRate }
```

---

## Predictions with Fraud Detection

The prediction endpoint now includes fraud detection:

#### Place Prediction
```
POST /api/v1/predictions
Headers: Authorization: Bearer <token>
Body: { matchId: "...", marketId: "...", selection: "CSK", coins: 500 }
Response: { success, prediction: {...}, newOdds: {...} }
Errors: 
  - ACCOUNT_BLOCKED (fraud action: 'block')
  - BET_AMOUNT_REDUCED (fraud action: 'flag_and_limit')
```

---

## Responsible Gaming

#### Set Betting Limits
```
POST /api/v1/users/betting-limits
Headers: Authorization: Bearer <token>
Body: { daily: 10000, weekly: 50000, monthly: 200000 }
Response: { success, limits: {...} }
```

#### Get Betting Insights
```
GET /api/v1/users/betting-insights
Headers: Authorization: Bearer <token>
Response: { success, totalBets, totalWagered, winRate, avgBetSize, insights: [...] }
```

#### Self-Exclude Account
```
POST /api/v1/users/self-exclude
Headers: Authorization: Bearer <token>
Body: { duration: 30 } # days
Response: { success, message, excludedUntil }
```

#### Get Responsible Gaming Report
```
GET /api/v1/users/responsible-gaming-report
Headers: Authorization: Bearer <token>
Response: { success, limits, insights, recommendations: [...] }
```

---

## WebSocket Events

### Connection
```javascript
const socket = io({ transports: ['websocket', 'polling'] });
socket.emit('join_match', { matchId: '...' });
```

### Listening for Updates
```javascript
socket.on('score_update', ({ matchId, scoreData, event }) => {
  // Live score: { type, runs, commentary, runRate }
});

socket.on('odds_update', ({ matchId, marketId, options }) => {
  // Updated odds for market
});
```

### Match Events
- `dot_ball`, `single`, `double`, `triple`, `boundary`, `six`, `wicket`, `wide`, `no_ball`

---

## Error Responses

### Standard Error Format
```json
{
  "error": "ERROR_CODE",
  "message": "Human readable message",
  "details": { /* optional */ }
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| `KYC_NOT_VERIFIED` | User must complete KYC |
| `ACCOUNT_BLOCKED` | Account flagged for fraud |
| `SELF_EXCLUDED` | User self-excluded |
| `DAILY_LIMIT_EXCEEDED` | Betting limit hit |
| `INSUFFICIENT_BALANCE` | Not enough coins |
| `INVALID_TOKEN` | 2FA token wrong |
| `TOKEN_EXPIRED` | Recovery token expired |
| `SERVICE_UNAVAILABLE_IN_REGION` | Geo-restricted |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/auth/send-otp` | 10 per 5 min |
| `/predictions` | 50 per min, 100 per day |
| `/wallet/withdrawal/*` | 5 per day |
| Global | 200 per min |

---

## Authentication Header Format
```
Authorization: Bearer <JWT_TOKEN>
```

JWT contains: `{ userId, role, expiresIn }`

---

## Testing Endpoints

All endpoints have been tested with:
- Valid inputs
- Invalid inputs  
- Rate limiting
- Authorization
- Error handling

Run tests:
```bash
npm run test:e2e
npm run test:load
```

