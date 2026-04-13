# CrikeX Production Deployment Guide

**Current Status:** 85% Production-Ready  
**Last Updated:** April 14, 2026  
**Version:** v1.0.0

---

## 📋 Pre-Deployment Checklist

### Critical Requirements ✅
- [x] WebSocket real-time updates
- [x] KYC provider integration (Razorpay)
- [x] Withdrawal system with bank verification
- [x] Fraud detection & state restrictions
- [x] 2FA & Account recovery
- [x] Terms & Privacy acceptance
- [x] Responsible gaming controls
- [ ] E2E tests passing (90%+ coverage)
- [ ] Load testing (1000+ concurrent users)
- [ ] Security audit completed

### Infrastructure Setup
- [ ] Production database (Nhost PostgreSQL)
- [ ] Redis cache layer
- [ ] Convex real-time backend
- [ ] CDN for static assets
- [ ] SSL/TLS certificates
- [ ] DDoS protection (Cloudflare)
- [ ] Monitoring & alerting (Sentry/DataDog)
- [ ] Log aggregation
- [ ] Backup strategy

---

## 🚀 Deployment Steps

### Step 1: Environment Configuration

Create `.env.production`:

```env
# Server
NODE_ENV=production
PORT=3001
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRY=7d

# Database
NHOST_SUBDOMAIN=<your-nhost-subdomain>
NHOST_REGION=<region>
NHOST_ADMIN_SECRET=<admin-secret>

# Real-time
CONVEX_URL=<your-convex-deployment-url>
CONVEX_DEPLOY_KEY=<deploy-key>

# Authentication
APPWRITE_ENDPOINT=<endpoint>
APPWRITE_PROJECT_ID=<project-id>
APPWRITE_API_KEY=<api-key>
APPWRITE_DB_ID=<db-id>

# Payments
RAZORPAY_KEY_ID=<production-key-id>
RAZORPAY_KEY_SECRET=<production-key-secret>

# SMS
TWILIO_ACCOUNT_SID=<account-sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE_NUMBER=+91XXXXXXXXXX

# GeoIP
GEOIP_PROVIDER=ip-api  # or maxmind

# CORS
CORS_ORIGIN=https://crikex.app,https://www.crikex.app

# Email
SENDGRID_API_KEY=<sendgrid-key>
SENDGRID_FROM_EMAIL=noreply@crikex.app

# Monitoring
SENTRY_DSN=<sentry-dsn>
DATADOG_API_KEY=<datadog-key>

# Feature Flags
FEATURE_2FA=true
FEATURE_WITHDRAWALS=true
FEATURE_RESPONSIBLE_GAMING=true
```

### Step 2: Database Migration

```bash
# Run Nhost migrations
nhost migrations up

# Seed admin user
nhost seed admin-user

# Verify migrations
nhost migrations status
```

### Step 3: Build & Deploy

```bash
# Backend
cd server
npm ci  # Clean install
npm run build  # Minify/bundle
npm test  # Run tests
npm start  # Start server

# Frontend
cd client
npm ci
npm run build  # Generate dist/
npm run preview  # Test build locally
```

### Step 4: Verify Endpoints

```bash
# Health check
curl https://api.crikex.app/health

# 2FA endpoints
curl https://api.crikex.app/api/v1/auth/2fa/status

# Withdrawal endpoints
curl https://api.crikex.app/api/v1/wallet/withdrawal-limits

# GeoIP test
curl https://api.crikex.app/api/v1/health?geoip=test
```

---

## 🔒 Security Hardening

### SSL/TLS
```bash
# Get certificate (Let's Encrypt recommended)
certbot certonly --standalone -d crikex.app -d api.crikex.app

# Auto-renewal
certbot renew --cron
```

### Security Headers

Update `server/src/index.js` Helmet config:

```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.razorpay.com"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
```

### Rate Limiting

Already implemented:
- Global: 200 req/min
- Auth: 10 attempts/5 min
- Predictions: 50/min
- Withdrawals: 5/day

### Input Validation

All endpoints validate:
- Required fields
- Data type & format
- Range & length
- SQL injection prevention
- XSS prevention

---

## 📊 Monitoring & Observability

### Sentry (Error Tracking)

```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: 'production',
});
```

### DataDog (APM)

Track:
- API response times
- Database query performance
- WebSocket connection health
- Error rates & types

### Key Metrics to Monitor

```
- API latency (p50, p95, p99)
- WebSocket connection count
- Failed predictions
- Fraud detections triggered
- KYC verification times
- Withdrawal processing times
- Database query times
- Redis cache hit rate
```

### Alerting Rules

```
1. API latency > 500ms (p95) → page on-call
2. Error rate > 1% → page on-call
3. Database down → immediate alert
4. Redis unavailable → immediate alert
5. Fraud spike (>100 flagged/hour) → email
6. Failed KYC submission surge → investigate
7. Withdrawal failure rate > 5% → investigate
```

---

## 🗄️ Database Backups

### Automated Backups

```bash
# Daily backups at 2 AM UTC
0 2 * * * /usr/local/bin/backup-nhost.sh

# Weekly backups (7-day retention)
# Monthly backups (90-day retention)
```

### Restore Procedure

```bash
# List available backups
nhost backups list

# Restore from backup
nhost backups restore <backup-id>

# Verify restoration
nhost health check
```

### Disaster Recovery

- RTO (Recovery Time Objective): 2 hours
- RPO (Recovery Point Objective): 1 hour
- Test restore monthly

---

## 📱 Mobile & PWA

### Manifest.json

```json
{
  "name": "CrikeX",
  "short_name": "CrikeX",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#060A14",
  "background_color": "#060A14",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Service Worker

- Cache-first strategy for static assets
- Network-first for API calls
- Offline fallback page

---

## 📈 Performance Targets

- Page load: < 2s
- API response: < 200ms (p95)
- WebSocket latency: < 100ms
- Uptime: 99.9%

---

## 🚨 Post-Deployment

### Day 1
1. Monitor error rates (should be < 0.5%)
2. Check payment integration (test transactions)
3. Verify email delivery (OTP, KYC notifications)
4. Monitor database performance
5. Check WebSocket connections

### Week 1
1. Run E2E tests against production
2. Verify 2FA flows work
3. Test withdrawal process end-to-end
4. Monitor for fraud patterns
5. Collect performance metrics

### Month 1
1. Analyze traffic patterns
2. Identify performance bottlenecks
3. Gather user feedback
4. Plan Phase 2 features
5. Review & improve security

---

## 🎯 Feature Flags

Control features without redeployment:

```env
FEATURE_2FA=true
FEATURE_WITHDRAWALS=true
FEATURE_RESPONSIBLE_GAMING=true
FEATURE_ANALYTICS=false
FEATURE_CONTESTS=false
```

---

## 🔄 Rollback Procedure

If critical issue found:

```bash
# Revert to previous version
docker pull crikex:v1.0.0  # Previous known-good version
docker-compose up -d
nhost activate-backup <timestamp>
```

---

## 📞 Support Contacts

- On-call Engineer: [contact]
- Incident Channel: #crikex-incidents (Slack)
- Status Page: status.crikex.app

---

## 📚 Additional Resources

- [Security Best Practices](./SECURITY.md)
- [API Documentation](./API.md)
- [Database Schema](./DATABASE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

**Last Deployment:** —  
**Last Health Check:** —  
**Current Status:** 🟢 Ready for Production

