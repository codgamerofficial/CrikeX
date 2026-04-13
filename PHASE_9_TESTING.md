# PHASE 9: Testing & Optimization Guide

**Status:** 95% → 98% Production-Ready  
**Date:** April 14, 2026

---

## 📋 Testing Strategy

### 1. **E2E Testing (Playwright)**

#### Setup
```bash
cd server
npm install  # Install @playwright/test
```

#### Configuration
- **File:** `tests/e2e/playwright.config.js`
- **Browsers:** Chromium, Firefox, WebKit
- **Scenarios:** 40+ integrated tests
- **Reporters:** HTML, JUnit, List

#### Test Suites

##### A. User Journey Tests (`user-journey.spec.js`)
- **20+ tests** covering complete flow:
  - Registration & login via OTP
  - KYC verification submission
  - Wallet deposit & balance check
  - Prediction placement & history
  - Contest joining & leaderboard
  - Withdrawal initiation
  - 2FA setup & verification
  - Responsible gaming limits
  - Analytics access
  - Feature flag verification

##### B. API Integration Tests (`api-integration.spec.js`)
- **30+ tests** for all API endpoints:
  - Auth endpoints (7)
  - User routes (5)
  - KYC routes (2)
  - 2FA routes (2)
  - Wallet routes (6)
  - Predictions routes (3)
  - Analytics routes (3)
  - Contests routes (3)
  - Leaderboard routes (1)
  - Admin routes (1)
  - Error handling (5)

#### Running Tests

**Run all tests:**
```bash
npm test
```

**Run E2E only:**
```bash
npm run test:e2e
```

**Run with UI mode (interactive):**
```bash
npm run test:e2e:ui
```

**Run with debug mode:**
```bash
npm run test:e2e:debug
```

**Run specific test file:**
```bash
npx playwright test tests/e2e/api-integration.spec.js
```

**Run specific test:**
```bash
npx playwright test -g "Register new user via OTP"
```

#### Test Reports
- **HTML Report:** `playwright-report/index.html`
- **JUnit XML:** `test-results.xml`
- **Screenshots:** Failed test screenshots in report
- **Videos:** Failed test videos in report
- **Traces:** Full browser traces for debugging

#### Expected Results
- ✅ All 50+ tests should pass in CI/CD
- ✅ Performance tests should show <3s load times
- ✅ Error handling tests verify proper error codes
- ✅ API tests validate request/response formats

---

### 2. **Load Testing (k6)**

#### Configuration
- **File:** `server/tests/load-test.js`
- **Framework:** Apache 2.0 licensed k6
- **Stages:** Ramp-up → Stress → Spike → Ramp-down
- **Virtual Users:** 10 → 50 → 100 → 10

#### Stages

| Stage | Duration | VUs | Purpose |
|-------|----------|-----|---------|
| Ramp-up | 30s | 0→10 | Warm up system |
| Stress | 90s | 10→50 | Identify bottlenecks |
| Spike | 20s | 50→100 | Test peak load |
| Ramp-down | 30s | 100→0 | Graceful shutdown |

#### Test Scenarios

1. **Authentication (5% traffic)**
   - Send OTP
   - Verify OTP

2. **KYC (3% traffic)**
   - Submit KYC

3. **Wallet (7% traffic)**
   - Get balance
   - Create deposit
   - Check transactions

4. **Predictions (60% traffic)** ← High load
   - 3 predictions per user
   - Tests concurrent bet handling
   - Validates fraud detection under load

5. **2FA (3% traffic)**
   - Setup 2FA
   - Verify token

6. **Withdrawals (3% traffic)**
   - Initiate withdrawal
   - Check limits

7. **Responsible Gaming (3% traffic)**
   - Check limits
   - Report usage

8. **WebSocket (16% traffic)**
   - Real-time updates
   - Multiple concurrent connections

#### Performance Thresholds

| Metric | Threshold | Purpose |
|--------|-----------|---------|
| p95 response time | < 500ms | 95% of requests fast |
| p99 response time | < 1000ms | Outliers acceptable |
| Error rate | < 10% | Overall resilience |
| Auth errors | < 5% | Auth reliability |
| Prediction errors | < 10% | Bet acceptance |
| Withdrawal errors | < 5% | Critical path |

#### Running Load Tests

**Local environment:**
```bash
npm run test:load
```

**Staging environment:**
```bash
npm run test:load:staging
```

**Custom configuration:**
```bash
k6 run \
  --vus 200 \
  --duration 5m \
  --stage 30s:100 \
  --stage 3m:200 \
  --stage 30s:50 \
  --stage 30s:0 \
  tests/load-test.js
```

**With CSV output:**
```bash
k6 run \
  --out csv=results.csv \
  tests/load-test.js
```

**With JSON output:**
```bash
k6 run \
  --out json=results.json \
  tests/load-test.js
```

#### Interpreting Results

**Sample Output:**
```
execution: local
     script: load-test.js
     output: -

scenarios: (100.00%) 1 scenario, 100 max VUs, 3m0s max duration
           (default scenario configured on line 1)

     data_received..................: 450 kB  2.5 kB/s
     data_sent......................: 180 kB  1.0 kB/s
     http_reqs......................: 5000    27.78/s
     http_req_duration..............: avg=125ms, p(95)=350ms, p(99)=800ms
     http_req_failed................: 5% ✓ (below 10% threshold)
     predictions_per_user...........: 3000/3000
     websocket_connections..........: active=450, total=600
```

**What it means:**
- ✅ 27.78 requests/sec - Good throughput
- ✅ avg 125ms - Responsive
- ✅ p95=350ms, p99=800ms - Within thresholds
- ✅ 5% error rate - Acceptable
- ✅ 3000/3000 predictions - High concurrency working
- ✅ 450 concurrent WebSocketsSometimes - Real-time is stable

#### Optimization Tips

**If thresholds are failing:**

1. **High p99 response times:**
   - Add database indexes
   - Implement caching (Redis)
   - Optimize N+1 queries

2. **High error rates:**
   - Check logs for errors
   - Verify database connections
   - Check rate limiting

3. **WebSocket failures:**
   - Increase connection pool
   - Check memory usage
   - Monitor CPU

**Database Optimizations:**
```sql
-- Add indexes for common queries
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
```

**Redis Caching:**
```bash
# Install Redis locally for testing
docker run -d -p 6379:6379 redis:latest

# Set in .env
REDIS_URL=redis://localhost:6379
```

---

### 3. **Performance Monitoring**

#### Application Performance Monitoring (APM)

**Setup Sentry (Error Tracking):**

```bash
npm install @sentry/node
```

```javascript
// server/src/index.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  denyUrls: [/\/health/],
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Setup DataDog (Metrics & APM):**

```bash
npm install dd-trace
```

```javascript
// server/src/index.js (before other imports)
const tracer = require('dd-trace').init({
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_TRACE_AGENT_PORT || 8126,
  env: process.env.NODE_ENV,
  service: 'crikex-api',
  version: '1.0.0',
});

tracer.use('express', {
  service: 'crikex-api',
  middleware: true,
});
```

#### Key Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Response Time (p50) | <100ms | >200ms |
| Response Time (p95) | <500ms | >1000ms |
| Error Rate | <1% | >5% |
| Memory Usage | <500MB | >800MB |
| CPU Usage | <60% | >80% |
| Database Latency | <50ms | >100ms |
| Cache Hit Rate | >80% | <60% |
| Concurrent Users | Scale out at 10k | N/A |

#### Custom Metrics

```javascript
// Track prediction placement rate
tracer.histogram('predictions.placed', 1, { market: 'match_winner' });

// Track fraud detection flags
tracer.increment('fraud.flags', 1, { reason: 'velocity_check' });

// Track withdrawal processing time
tracer.histogram('withdrawal.time', processingTime, { status: 'completed' });
```

#### Dashboards

Create dashboards with:
1. Request rate (requests/sec)
2. Error rate (%)
3. Response time distribution (p50, p95, p99)
4. Database performance
5. Cache hit rate
6. Active concurrent users
7. Memory & CPU usage
8. Business metrics (bets/sec, revenue/sec)

---

### 4. **Security Audit Checklist**

#### A. OWASP Top 10 Checks

- [ ] **A01: Broken Access Control**
  - Users can't access others' data
  - Admin endpoints properly gated
  - Rate limiting on sensitive endpoints

- [ ] **A02: Cryptographic Failures**
  - Passwords hashed (bcryptjs)
  - Sensitive data encrypted in transit (HTTPS/TLS)
  - No hardcoded secrets
  - Tokens have expiration

- [ ] **A03: Injection**
  - No SQL injection (using GraphQL/ORM)
  - Input validation on all endpoints
  - Command injection prevention

- [ ] **A04: Insecure Design**
  - Authentication required for all protected endpoints
  - Business logic validation
  - Rate limiting active

- [ ] **A05: Security Misconfiguration**
  - No debug mode in production
  - Security headers set (Helmet)
  - CORS properly configured
  - HTTPS enforced

- [ ] **A06: Vulnerable Components**
  - Dependencies up to date
  - No known CVEs: `npm audit`
  - Regular dependency scanning

- [ ] **A07: Authentication Failures**
  - 2FA implemented
  - Session management secure
  - Password requirements enforced
  - Account lockout after failed attempts

- [ ] **A08: Software & Data Integrity**
  - Code reviewed and signed
  - Dependencies verified
  - Update mechanism secure

- [ ] **A09: Logging & Monitoring**
  - All transactions logged
  - Security events tracked
  - Alerts for suspicious activity

- [ ] **A10: Server-Side Request Forgery (SSRF)**
  - Webhook validation
  - URL validation for external APIs
  - No blind redirects

#### B. India-Specific Compliance

- [ ] **DPDP Act (2023)**
  - Consent recorded (Terms/Privacy)
  - Data minimization
  - User rights implemented (export, delete)

- [ ] **RBI Guidelines**
  - Balance validation (no negative)
  - Transaction logging
  - Fraud monitoring

- [ ] **PCI-DSS (Payment Processing)**
  - No credit card storage (use Razorpay)
  - TLS for payment data
  - Access logging

- [ ] **GST Compliance**
  - 18% GST on betting winnings
  - TDS 30% on winnings
  - GST registration for transactions

#### C. Penetration Testing

**Run security scan:**
```bash
# OWASP Dependency Scanning
npm audit

# Static Analysis
npm install -g semgrep
semgrep --config=p/security-audit src/

# Docker container scan
trivy image crikex-api:latest
```

**Manual Testing Scenarios:**

1. **SQL Injection Test:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/predictions \
     -d '{"stake": "100; DROP TABLE predictions--"}'
   # Should fail gracefully
   ```

2. **CSRF Test:**
   - Open app in browser
   - Check for CSRF tokens
   - Verify SameSite cookie flag

3. **XSS Test:**
   - Add `<script>alert('xss')</script>` to user input
   - Verify it's escaped in output

4. **Rate Limit Test:**
   ```bash
   for i in {1..100}; do
     curl http://localhost:3000/api/v1/auth/send-otp \
       -d '{"phone":"+919876543210"}' &
   done
   # Should get 429 responses
   ```

5. **Auth Bypass Test:**
   ```bash
   curl http://localhost:3000/api/v1/users/profile \
     -H "Authorization: Bearer invalid"
   # Should return 401
   ```

---

## 🎯 Pre-Production Checklist

### Testing Complete
- [ ] All E2E tests passing (50+ tests)
- [ ] Load tests successful (100 VUs)
- [ ] Performance tests < 3s load time
- [ ] Error handling verified
- [ ] Security audit passed

### Performance Verified
- [ ] p95 response time < 500ms
- [ ] p99 response time < 1000ms
- [ ] Error rate < 10%
- [ ] Memory usage < 500MB
- [ ] CPU usage stable < 60%

### Security Verified
- [ ] OWASP top 10 addressed
- [ ] DPDP compliance verified
- [ ] RBI guidelines followed
- [ ] PCI-DSS for payments
- [ ] Penetration testing passed

### Monitoring Ready
- [ ] Sentry configured
- [ ] DataDog dashboards created
- [ ] Alert thresholds set
- [ ] Logging centralized
- [ ] On-call runbook prepared

---

## 📊 Test Results Template

```markdown
# Test Results - DATE

## E2E Tests
- Total Tests: 50
- Passed: 50 ✅
- Failed: 0
- Skipped: 0
- Duration: 5m 23s

## Load Tests
- Duration: 3m
- Avg Response Time: 145ms
- p95: 420ms
- p99: 890ms
- Requests: 5000
- Errors: 320 (6.4%)
- Throughput: 27.8 req/s

## Performance Tests
- Dashboard Load: 1.2s ✅
- Matches List: 2.1s ✅
- API Response: 180ms ✅

## Security Audit
- Vulnerabilities Found: 0
- Warnings: 0
- Compliance: ✅ DPDP, ✅ RBI, ✅ PCI-DSS

## Ready for Production: ✅
```

---

## 🚀 Next Steps

1. ✅ **E2E Tests** - Created & ready
2. ✅ **Load Tests** - Configured (k6 existing)
3. ✅ **Performance Monitoring** - APM setup guide provided
4. ✅ **Security Audit** - Checklist provided

**Proceed to:**
- Run all tests against staging environment
- Configure production monitoring
- Prepare deployment infrastructure
- Execute final security audit
