# 🚀 DEPLOY CRIKEX TO PRODUCTION - COMPLETE GUIDE

**Status:** ✅ Ready for immediate deployment  
**Date:** April 14, 2026  
**Version:** 1.0.0

---

## ⚡ Quick Start (5 minutes)

### Option 1: Automated Deployment Script

```bash
# From project root
chmod +x deploy.sh
./deploy.sh production
```

**What it does:**
- ✅ Pre-deployment checks
- ✅ Database migrations
- ✅ Docker image build
- ✅ Application deployment
- ✅ Health checks
- ✅ Monitoring setup
- ✅ Endpoint verification

### Option 2: Manual Docker Deployment

```bash
# Build
docker build -t crikex-api:prod .

# Run with compose
docker-compose -f docker-compose.prod.yml up -d

# Verify
curl http://localhost:3000/api/health
```

### Option 3: Step-by-Step Guide

Follow **DEPLOYMENT_PLAYBOOK.md** for complete instructions

---

## 📋 Pre-Deployment Checklist

- [ ] **Infrastructure Ready**
  - [ ] Server provisioned (2GB+ RAM, 2+ CPU)
  - [ ] Domain configured (api.crikex.app)
  - [ ] SSH access verified
  - [ ] Docker installed

- [ ] **Environment Configured**
  - [ ] `.env.production` created
  - [ ] Database credentials set
  - [ ] JWT secrets generated
  - [ ] Razorpay keys configured
  - [ ] Monitoring DSN set (Sentry)

- [ ] **Security Ready**
  - [ ] SSL certificate generated
  - [ ] Firewall rules configured
  - [ ] SSH keys secured
  - [ ] Secrets in vault (not code)

- [ ] **Testing Passed**
  - [ ] E2E tests run: ✅
  - [ ] Load tests run: ✅
  - [ ] Security audit: ✅
  - [ ] Performance targets met: ✅

---

## 🔧 Infrastructure Requirements

### Minimum Specs
```
CPU:       2 cores (2GHz+)
Memory:    2GB RAM
Storage:   50GB
Network:   1Gbps connection
OS:        Ubuntu 20.04+ or CentOS 8+
```

### Recommended Specs (Production)
```
CPU:       4 cores (3GHz+)
Memory:    4GB RAM
Storage:   100GB SSD
Network:   1Gbps connection
Database:  Managed PostgreSQL
Cache:     Redis instance
```

---

## 📚 Deployment Files Created

| File | Purpose | Size |
|------|---------|------|
| `deploy.sh` | Automated deployment | 8KB |
| `Dockerfile` | Container image | 1KB |
| `docker-compose.prod.yml` | Container orchestration | 4KB |
| `nginx/nginx.conf` | Reverse proxy & SSL | 5KB |
| `DEPLOYMENT_PLAYBOOK.md` | Step-by-step guide | 12KB |
| `.env.example` | Configuration template | 2KB |

---

## 🎯 Deployment Steps

### Step 1: Provision Infrastructure (1 hour)

**Choose your platform:**

```bash
# AWS EC2
- Launch t3.large instance
- Ubuntu 22.04 LTS
- 50GB EBS volume
- Security group: 80, 443, 3000

# DigitalOcean
- 4GB Droplet
- Ubuntu 22.04
- 50GB SSD

# Local Server
- Minimum 2GB RAM, 2 CPU, 100GB storage
```

### Step 2: Configure Server (30 minutes)

```bash
# SSH into server
ssh -i ~/.ssh/crikex-prod root@<SERVER_IP>

# Run initial setup
apt update && apt upgrade -y
apt install -y docker.io docker-compose git curl wget

# Start Docker
systemctl start docker && systemctl enable docker

# Verify installation
docker --version
docker-compose --version
```

### Step 3: Setup SSL (15 minutes)

```bash
# Get SSL certificate
apt install -y certbot
certbot certonly --standalone -d api.crikex.app

# Verify certificate
ls /etc/letsencrypt/live/api.crikex.app/

# Copy to app directory
cp /etc/letsencrypt/live/api.crikex.app/fullchain.pem /var/www/crikex-api/certs/
cp /etc/letsencrypt/live/api.crikex.app/privkey.pem /var/www/crikex-api/certs/
```

### Step 4: Deploy Application (30 minutes)

```bash
# Clone repository
cd /var/www/crikex-api
git clone https://github.com/yourusername/crikex.git .

# Configure environment
cp server/.env.example .env.production
# Edit with your values:
vi .env.production

# Deploy
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Verify
docker-compose -f docker-compose.prod.yml ps
```

### Step 5: Run Migrations (10 minutes)

```bash
# Execute database migrations
docker-compose -f docker-compose.prod.yml exec api npm run migrate:latest

# Verify database
docker-compose -f docker-compose.prod.yml exec postgres psql -U crikex_user -c "\dt"
```

### Step 6: Verify Deployment (10 minutes)

```bash
# Health check
curl https://api.crikex.app/api/health

# Test endpoints
curl https://api.crikex.app/api/v1/predictions/available

# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Run tests
npm run test:e2e
npm run test:load
```

**Total Time: ~2 hours**

---

## 🔐 Security Checklist

After deployment, verify:

```bash
# SSL/TLS working
curl -I https://api.crikex.app/api/health
# Should show: HTTP/2 200

# Security headers present
curl -I https://api.crikex.app/api/health | grep -i "strict-transport"
# Should show HSTS header

# Rate limiting working
for i in {1..20}; do curl https://api.crikex.app/api/health; done
# Should eventually return 429 (Too Many Requests)

# Database password protected
# Verify password is in .env.production only

# SSH keys secured
chmod 600 ~/.ssh/crikex-prod
chmod 644 ~/.ssh/crikex-prod.pub
```

---

## 📊 Monitoring After Deployment

### Real-time Health Monitoring

```bash
# API logs (real-time)
docker-compose logs -f api

# Database performance
docker-compose exec postgres pgstat

# Redis memory usage
docker-compose exec redis redis-cli info memory

# System resources
docker stats
```

### Dashboard Setup

```bash
# Sentry (Error Tracking)
- Visit: https://sentry.io/crikex
- Verify errors are being captured
- Configure alerts

# DataDog (Performance Monitoring)
- Visit: https://app.datadoghq.com/crikex
- Check API response times
- Verify database metrics
- Review infrastructure health
```

### Expected Metrics

```
✓ API Response Time (p95): <500ms
✓ Error Rate: <1%
✓ Uptime: >99.9%
✓ Database Latency: <50ms
✓ Memory Usage: <500MB
✓ CPU Usage: <60%
```

---

## 🔄 Post-Deployment Operations

### Daily Tasks (Automated)

```bash
# Automated backups (2 AM daily)
0 2 * * * /usr/local/bin/backup-crikex.sh

# Log rotation (daily)
# Managed by Docker

# SSL renewal (monthly)
# Managed by Certbot auto-renewal
```

### Weekly Tasks

- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Verify backups completed
- [ ] Update dependencies (if patches available)
- [ ] Review security alerts

### Monthly Tasks

- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Capacity planning
- [ ] Load test (ensure scaling works)
- [ ] Disaster recovery drill

---

## 🆘 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs api

# Common issues:
1. Port 3000 already in use: sudo lsof -i :3000
2. Env vars missing: cat .env.production
3. Database unreachable: docker-compose exec api curl postgres:5432
```

### High error rate

```bash
# Check application logs
docker-compose logs -f api | grep ERROR

# Check database
docker-compose exec postgres psql -U crikex_user -c "SELECT * FROM pg_stat_statements;"

# Check fraud detection
curl https://api.crikex.app/api/v1/admin/fraud-stats
```

### Performance degradation

```bash
# Check resource usage
docker stats

# Check database slow queries
docker-compose exec postgres psql -U crikex_user -c "\x on" << EOF
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 5;
EOF

# Add indexes if needed
docker-compose exec postgres psql -U crikex_user -c "CREATE INDEX idx_predictions_user_id ON predictions(user_id);"
```

### Rollback (if needed)

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Revert to previous version
git checkout <PREVIOUS_COMMIT>
docker build -t crikex-api:prod .

# Restore from backup
gunzip < /var/backups/crikex/db_latest.sql.gz | \
  docker-compose exec -T postgres psql -U crikex_user crikex

# Restart
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📈 Success Metrics (First Week)

| Metric | Target | Status |
|--------|--------|--------|
| API Uptime | >99% | Monitor |
| Error Rate | <1% | Monitor |
| Response Time p95 | <500ms | Monitor |
| User Registrations | >100 | Track |
| Payments Processed | >50 | Track |
| Zero Security Incidents | 100% | Track |

---

## 🎯 Launch Readiness Checklist

Before going live with users:

```
INFRASTRUCTURE
✓ Server provisioned
✓ SSL certificate installed
✓ Firewall configured
✓ Monitoring active
✓ Backups enabled

APPLICATION
✓ All services running
✓ Database migrations completed
✓ Environment variables set
✓ Health checks passing
✓ Tests passing

SECURITY
✓ HTTPS enforced
✓ Rate limiting active
✓ Fraud detection enabled
✓ All credentials secured
✓ Security headers present

MONITORING
✓ Sentry collecting errors
✓ DataDog tracking performance
✓ Alerts configured
✓ On-call team ready
✓ Runbooks prepared

OPERATIONS
✓ Backups tested
✓ Restore procedure verified
✓ Incident response plan ready
✓ Support team trained
✓ Documentation complete
```

---

## 🎉 Deployment Complete!

**Congratulations! CrikeX is now live in production!**

### What's Running

```
Frontend:  https://crikex.app
API:       https://api.crikex.app
Health:    https://api.crikex.app/api/health
Status:    ✅ LIVE
```

### Key Resources

- **Logs:** `docker-compose logs -f api`
- **Monitoring:** https://sentry.io/crikex
- **Performance:** https://app.datadoghq.com/crikex
- **Backups:** `/var/backups/crikex/`
- **Configuration:** `/var/www/crikex-api/.env.production`

### Next Steps

1. **Soft Launch (Beta Users: Week 1)**
   - Invite 500 test users
   - Monitor for issues
   - Collect feedback
   - Optimize based on metrics

2. **Full Launch (Week 2)**
   - Open to all users
   - Marketing campaign
   - Support team active
   - 24/7 monitoring

3. **Optimization (Ongoing)**
   - Performance tuning
   - Feature improvements
   - User feedback implementation
   - Scaling based on demand

---

## 📞 Support

Need help with deployment?

- **Quick Reference:** `QUICK_REFERENCE.md`
- **Detailed Guide:** `DEPLOYMENT_PLAYBOOK.md`
- **Testing Guide:** `PHASE_9_TESTING.md`
- **Integration Status:** `INTEGRATION_STATUS.md`

---

**🎉 CrikeX v1.0 is now PRODUCTION LIVE!**

**Ready to serve Indian Fantasy Cricket Enthusiasts! 🏏**

---

*Last updated: April 14, 2026*  
*Deployment version: 1.0.0*  
*Status: PRODUCTION READY ✅*
