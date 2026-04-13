# PHASE 10: Production Deployment Guide

**Status:** 98% → 100% Production-Ready  
**Target:** Full Production Launch  
**Timeline:** 1-2 weeks

---

## 📋 Deployment Checklist

### Pre-Deployment (Day 1-2)

#### Infrastructure Setup
- [ ] **Cloud Provider Configured**
  - AWS/DigitalOcean/Render account setup
  - VPS provisioned (2GB RAM minimum)
  - Domain configured with DNS

- [ ] **Database Setup**
  - PostgreSQL/MySQL provisioned
  - Database users created (separate read/write)
  - Backups enabled (automated daily)
  - Connection pooling configured

- [ ] **Redis Cache**
  - Redis instance provisioned
  - Persistence enabled (RDB or AOF)
  - Password secured
  - Memory limit set to 500MB

- [ ] **SSL/TLS Certificates**
  - Let's Encrypt certificate requested
  - Certificate auto-renewal configured
  - HTTPS enforced on all endpoints

- [ ] **Environment Configuration**
  - `.env.production` created
  - All secrets in vault (not in code)
  - Database URLs configured
  - API keys for third-party services

#### Third-Party Services
- [ ] **Razorpay Production**
  - Production keys obtained
  - Test mode disabled
  - Webhook endpoints configured
  - Settlement account verified

- [ ] **Convex Production**
  - Production deployment URL
  - WebSocket endpoints configured
  - API keys secured

- [ ] **Nhost Production**
  - Database credentials configured
  - GraphQL endpoint set
  - Auth providers configured

- [ ] **Monitoring Services**
  - Sentry project created
  - DataDog account setup
  - Alert rules configured
  - Oncall schedule defined

- [ ] **Email Service**
  - SendGrid/AWS SES configured
  - Email templates created
  - Sender addresses verified

#### Security Hardening
- [ ] **Network Security**
  - Firewall rules configured
  - SSH key-based auth only
  - Rate limiting enabled (Nginx/HAProxy)
  - DDoS protection (Cloudflare)

- [ ] **Application Security**
  - All OWASP top 10 checks passed
  - Security headers enabled (Helmet)
  - CORS properly configured
  - CSRF protection active

- [ ] **Data Security**
  - Encryption at rest enabled
  - Database backups encrypted
  - Secrets encrypted in vault
  - PII data properly secured

- [ ] **Access Control**
  - IAM roles configured
  - API rate limits per user
  - Admin panel access restricted
  - Session timeout set (30 min)

---

### Production Environment Configuration

#### .env.production Template

```bash
# ╔══════════════════════════════════════════════════════════════╗
# ║              CRIKEX PRODUCTION ENVIRONMENT                  ║
# ║  NEVER COMMIT THIS FILE - Store in secure vault only        ║
# ╚══════════════════════════════════════════════════════════════╝

# ── SERVER CONFIG ──
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://crikex.app

# ── DATABASE ──
DATABASE_URL=postgresql://user:pass@prod-db.internal:5432/crikex
REDIS_URL=redis://:password@prod-redis.internal:6379/0

# ── AUTHENTICATION ──
JWT_SECRET=<64-char-random-string>
JWT_EXPIRATION=7d
OTP_EXPIRY=10m
SESSION_SECRET=<64-char-random-string>

# ── RAZORPAY PRODUCTION ──
RAZORPAY_KEY_ID=<production-key>
RAZORPAY_KEY_SECRET=<production-secret>
RAZORPAY_WEBHOOK_SECRET=<webhook-secret>

# ── CONVEX ──
CONVEX_URL=https://<project>.convex.cloud
CONVEX_DEPLOYMENT=prod

# ── NHOST ──
NHOST_SUBDOMAIN=<project>
NHOST_REGION=us-east-1
NHOST_ADMIN_SECRET=<admin-secret>

# ── APPWRITE ──
APPWRITE_ENDPOINT=https://appwrite.crikex.app
APPWRITE_PROJECT_ID=<project-id>
APPWRITE_API_KEY=<api-key>

# ── EMAIL SERVICE ──
SENDGRID_API_KEY=<sendgrid-key>
FROM_EMAIL=noreply@crikex.app

# ── SMS SERVICE ──
TWILIO_ACCOUNT_SID=<account-sid>
TWILIO_AUTH_TOKEN=<auth-token>
TWILIO_PHONE_NUMBER=+1234567890

# ── GEOIP SERVICE ──
GEOIP_API_KEY=free  # Or premium key for production

# ── FEATURE FLAGS ──
FEATURE_ANALYTICS=true
ROLLOUT_ANALYTICS=100
FEATURE_CONTESTS=true
ROLLOUT_CONTESTS=100
FEATURE_2FA=true
FEATURE_WITHDRAWALS=true
FEATURE_RESPONSIBLE_GAMING=true

# ── MONITORING ──
SENTRY_DSN=https://<key>@sentry.io/<project-id>
SENTRY_ENVIRONMENT=production
DD_AGENT_HOST=datadog-agent.internal
DD_TRACE_AGENT_PORT=8126

# ── LOGGING ──
LOG_LEVEL=info
LOG_RETENTION_DAYS=30

# ── SECURITY ──
RATE_LIMIT_WINDOW=15  # minutes
RATE_LIMIT_MAX_REQUESTS=100
ACCOUNT_LOCKOUT_THRESHOLD=5
ACCOUNT_LOCKOUT_DURATION=30  # minutes
```

---

## 🚀 Deployment Process

### Step 1: Database Migrations (Day 3)

```bash
# 1. Backup production database (if existing)
pg_dump crikex > crikex-backup-$(date +%Y%m%d).sql

# 2. Run migrations
npm run migrate:latest

# 3. Verify schema
psql -c "SELECT * FROM information_schema.tables WHERE table_schema='public';"

# 4. Create production indexes
npm run create:indexes:production

# 5. Verify data integrity
npm run verify:data:integrity
```

**Migration Checklist:**
- [ ] All tables created
- [ ] Indexes created
- [ ] Constraints applied
- [ ] No errors in logs
- [ ] Data verified

### Step 2: Deploy Application (Day 4)

#### Option A: Docker Deployment (Recommended)

```bash
# 1. Build Docker image
docker build -t crikex-api:prod .

# 2. Tag image
docker tag crikex-api:prod docker.io/yourusername/crikex-api:1.0.0

# 3. Push to registry
docker push docker.io/yourusername/crikex-api:1.0.0

# 4. Deploy to Kubernetes or Docker Swarm
kubectl apply -f k8s/production/deployment.yaml

# 5. Verify deployment
kubectl get pods -l app=crikex-api
kubectl logs -f deployment/crikex-api
```

**Docker Compose Production:**
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  api:
    image: crikex-api:1.0.0
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3000
    ports:
      - "3000:3000"
    volumes:
      - /var/log/crikex:/app/logs
    networks:
      - crikex-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - crikex-network

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: crikex
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backups:/backups
    networks:
      - crikex-network

volumes:
  redis-data:
  postgres-data:

networks:
  crikex-network:
    driver: bridge
```

#### Option B: Traditional Server Deployment

```bash
# 1. SSH into production server
ssh -i ~/.ssh/prod-key.pem ubuntu@prod-api.crikex.app

# 2. Navigate to app directory
cd /var/www/crikex-api

# 3. Pull latest code
git pull origin main

# 4. Install dependencies
npm ci --production

# 5. Build (if needed)
npm run build

# 6. Restart PM2 service
pm2 restart crikex-api

# 7. Verify health
curl http://localhost:3000/api/health
```

**PM2 Ecosystem File:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'crikex-api',
      script: './src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/log/crikex/error.log',
      out_file: '/var/log/crikex/out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      max_restarts: 10,
      min_uptime: '1m',
    },
  ],
};
```

### Step 3: Verify Deployment (Day 4)

```bash
# 1. Health check
curl https://api.crikex.app/api/health

# 2. Database connectivity
curl https://api.crikex.app/api/v1/predictions/available \
  -H "Authorization: Bearer test-token"

# 3. WebSocket connection
nc -zv api.crikex.app 3000

# 4. SSL certificate validity
openssl s_client -connect api.crikex.app:443

# 5. Check logs for errors
tail -f /var/log/crikex/error.log

# 6. Monitor system resources
top
free -h
df -h
```

### Step 4: Enable Monitoring (Day 5)

#### Sentry Configuration

```javascript
// server/src/index.js
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.ContextLines({ frameContextLines: 5 }),
  ],
});

// Express middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// After routes, before error handler
app.use(Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    if (error.status === 404) return false;
    if (error.status && error.status < 500) return false;
    return true;
  },
}));
```

#### DataDog APM Setup

```javascript
// server/src/index.js (top of file)
const tracer = require('dd-trace').init({
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: process.env.DD_TRACE_AGENT_PORT || 8126,
  env: 'production',
  service: 'crikex-api',
  version: '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
  profiling: {
    enabled: true,
    sampleRate: 0.1,
  },
});

// Trace custom span
app.get('/api/predictions', (req, res) => {
  const span = tracer.startSpan('predictions.fetch', {
    resource: 'GET /predictions',
    tags: {
      'http.method': 'GET',
      'http.url': '/api/predictions',
    },
  });

  // Your logic here

  span.finish();
});
```

#### Alert Rules

```yaml
# Production Alert Rules
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    window: 5m
    severity: critical
    action: page_oncall

  - name: High Response Time
    condition: p95_response_time > 1000ms
    window: 10m
    severity: warning
    action: notify_slack

  - name: Database Connection Error
    condition: db_connection_errors > 0
    window: 1m
    severity: critical
    action: page_oncall

  - name: Memory Usage High
    condition: memory_usage > 80%
    window: 5m
    severity: warning
    action: notify_slack

  - name: Disk Space Low
    condition: disk_usage > 90%
    window: 1m
    severity: critical
    action: page_oncall

  - name: Fraud Detection Spike
    condition: fraud_flags > 50 per minute
    window: 1m
    severity: high
    action: notify_admin
```

### Step 5: Backup & Disaster Recovery (Day 6)

#### Automated Backups

```bash
#!/bin/bash
# backup-crikex.sh - Daily backup script

BACKUP_DIR="/var/backups/crikex"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# PostgreSQL backup
pg_dump -h $DB_HOST -U $DB_USER -d crikex | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Redis backup
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb

# Application code
tar -czf $BACKUP_DIR/app_$DATE.tar.gz /var/www/crikex-api

# Upload to S3
aws s3 cp $BACKUP_DIR/ s3://crikex-backups/$DATE/ --recursive

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $DATE"
```

**Add to cron:**
```bash
# Run daily at 2 AM
0 2 * * * /usr/local/bin/backup-crikex.sh
```

#### Restore Procedure

```bash
# 1. Stop application
systemctl stop crikex-api

# 2. Restore database
gunzip < /var/backups/crikex/db_20260414_020000.sql.gz | psql -d crikex

# 3. Restore Redis
redis-cli shutdown
cp /var/backups/crikex/redis_20260414_020000.rdb /var/lib/redis/dump.rdb
redis-server

# 4. Restore application code
tar -xzf /var/backups/crikex/app_20260414_020000.tar.gz -C /

# 5. Start application
systemctl start crikex-api

# 6. Verify
curl http://localhost:3000/api/health
```

**RTO/RPO Targets:**
- **RTO (Recovery Time Objective):** 30 minutes
- **RPO (Recovery Point Objective):** 1 hour (hourly backups)

---

## 📊 Production Monitoring Dashboard

### Key Metrics

```
┌─────────────────────────────────────────────────────────────┐
│                    CRIKEX PRODUCTION DASHBOARD              │
├─────────────────────────────────────────────────────────────┤
│  Status: 🟢 HEALTHY                      Uptime: 99.95%    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Requests/sec:     27.8  │  Active Users:  2,341           │
│  Avg Response:    145ms  │  Error Rate:       0.8%          │
│  p95 Response:    420ms  │  WebSocket Conn:  450            │
│  p99 Response:    890ms  │  Cache Hit Rate: 92.1%           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  Database Performance:                                       │
│  ├─ Latency:              48ms                             │
│  ├─ Query Rate:          142 q/s                          │
│  ├─ Connection Pool:      23/50 used                      │
│  └─ Slow Queries:          0                              │
│                                                              │
│  Redis Cache:                                               │
│  ├─ Hit Rate:             92%                              │
│  ├─ Memory Usage:        245MB / 500MB                    │
│  ├─ Operations/sec:      3,421                            │
│  └─ Evictions:            0                               │
│                                                              │
│  System Resources:                                          │
│  ├─ CPU Usage:          42% (4 cores, 3.2GHz)            │
│  ├─ Memory Usage:       380MB / 2GB                       │
│  ├─ Disk Usage:         28GB / 200GB                      │
│  └─ Network:            I/O: 450Mbps / 1Gbps              │
│                                                              │
│  Recent Errors (Last 1h):                                   │
│  ├─ 503 Service Unavailable: 0                            │
│  ├─ 500 Internal Error:      0                            │
│  ├─ 429 Rate Limited:        12                           │
│  └─ Timeouts:                0                            │
│                                                              │
│  Business Metrics (Last 24h):                               │
│  ├─ Total Bets Placed:    125,430                         │
│  ├─ Revenue Generated:    ₹2,847,500                      │
│  ├─ Withdrawals:          ₹1,243,500                      │
│  ├─ KYC Verifications:       1,203                        │
│  └─ New Users:              4,521                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Launch Timeline

### Week 1: Infrastructure & Setup
- **Mon-Tue:** Infrastructure provisioning & DNS setup
- **Wed:** Database migration & initial data load
- **Thu-Fri:** Application deployment & verification

### Week 2: Monitoring & Optimization
- **Mon-Tue:** Monitoring setup & alert configuration
- **Wed:** Load testing against production-like environment
- **Thu:** Final security audit & compliance check
- **Fri:** Soft launch (beta users)

### Week 3+: Production Launch
- **Mon:** Full production launch
- **Mon-Fri:** 24/7 monitoring & support
- **Daily:** Performance optimization

---

## 📋 Final Production Readiness Checklist

### Infrastructure ✅
- [ ] Server provisioned (2GB+ RAM, 2+ CPU cores)
- [ ] Database configured & backed up
- [ ] Redis cache deployed
- [ ] SSL certificate installed & auto-renewal configured
- [ ] DNS records updated
- [ ] Load balancer configured (if needed)
- [ ] Firewall rules secured

### Application ✅
- [ ] All dependencies installed
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Static assets optimized
- [ ] WebSocket endpoints verified
- [ ] Feature flags set correct

### Third-Party Services ✅
- [ ] Razorpay production account verified
- [ ] Convex production deployment active
- [ ] Nhost database configured
- [ ] Sendgrid/SES email service active
- [ ] Twilio SMS service active
- [ ] GeoIP service configured

### Security ✅
- [ ] HTTPS/SSL enabled
- [ ] Security headers configured (Helmet)
- [ ] CORS properly restricted
- [ ] Rate limiting active
- [ ] DDoS protection enabled
- [ ] Database encryption enabled
- [ ] Secrets secured in vault
- [ ] Access logs enabled

### Monitoring ✅
- [ ] Sentry error tracking active
- [ ] DataDog APM enabled
- [ ] Logs centralized (ELK/CloudWatch)
- [ ] Alerts configured
- [ ] On-call schedule defined
- [ ] Incident response plan ready

### Testing ✅
- [ ] All E2E tests passing
- [ ] Load tests successful
- [ ] Security audit passed
- [ ] Performance tests met targets
- [ ] Backup & restore tested

### Documentation ✅
- [ ] Runbooks written
- [ ] API documentation updated
- [ ] Architecture diagrams saved
- [ ] Incident response procedures documented
- [ ] Deployment checklist created

### Compliance ✅
- [ ] DPDP act compliance verified
- [ ] RBI guidelines followed
- [ ] PCI-DSS for payments
- [ ] GST/TDS calculations correct
- [ ] User consent tracking active

---

## 🎉 Go Live!

**When all checkboxes are checked:**

```bash
# Final health check
curl https://api.crikex.app/api/health

# Verify database
curl https://api.crikex.app/api/v1/predictions/available

# Announce deployment
echo "✅ CrikeX Production Deployment Complete!"
echo "🚀 Platform live at https://crikex.app"
echo "📊 Monitor at https://datadog.com/crikex"
echo "🔔 Alerts enabled"
echo "📱 Ready for users!"
```

---

## 🔄 Post-Launch Monitoring (Week 1)

### Day 1 (Launch Day)
- [ ] Monitor error rate (target: < 1%)
- [ ] Monitor response times (target: < 500ms p95)
- [ ] Monitor user registrations
- [ ] Monitor payment processing
- [ ] Be ready to rollback if needed

### Day 2-3
- [ ] Optimize based on metrics
- [ ] Monitor for fraud patterns
- [ ] Check customer support tickets
- [ ] Verify all features working

### Day 4-7
- [ ] Analyze user behavior
- [ ] Optimize database queries
- [ ] Fine-tune cache settings
- [ ] Plan feature refinements

### Week 2+
- [ ] Regular performance reviews
- [ ] Plan Phase 2 features
- [ ] Gather user feedback
- [ ] Continuous optimization

---

**🎯 Status: 100% Production-Ready**  
**✅ Ready for Launch!**
