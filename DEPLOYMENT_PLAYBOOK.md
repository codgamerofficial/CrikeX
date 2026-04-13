# 🚀 CrikeX Production Deployment Playbook

**Date:** April 14, 2026  
**Version:** 1.0.0  
**Environment:** Production

---

## 📋 Pre-Deployment: Infrastructure Setup

### Step 1: Provision Server (Cloud Provider)

**Option A: AWS EC2**
```bash
# Launch EC2 instance
Instance Type: t3.large (2GB RAM, 2 vCPU)
OS: Ubuntu 22.04 LTS
Storage: 50GB EBS (gp3)
Security Group: Allow 80, 443, 3000, 5432, 6379 from your IPs
```

**Option B: DigitalOcean Droplet**
```bash
# Create droplet
Plan: 4GB RAM, 2 vCPU
OS: Ubuntu 22.04
Size: 50GB SSD
```

**Option C: Local/On-Premise Server**
```bash
# Minimum requirements
- 2GB RAM
- 2 CPU cores
- 100GB storage
- Ubuntu 20.04+ or CentOS 8+
```

### Step 2: Configure Domain

```bash
# Update DNS records
# Type: A Record
# Name: api
# Value: <YOUR_SERVER_PUBLIC_IP>

# Verify DNS
nslookup api.crikex.app
dig api.crikex.app
```

### Step 3: SSH Access Setup

```bash
# Generate SSH key (if not already done)
ssh-keygen -t ed25519 -f ~/.ssh/crikex-prod -C "crikex-prod"

# Copy public key to server
ssh-copy-id -i ~/.ssh/crikex-prod.pub root@<SERVER_IP>

# Test SSH connection
ssh -i ~/.ssh/crikex-prod root@<SERVER_IP>
```

### Step 4: Initial Server Configuration

```bash
# SSH into server
ssh -i ~/.ssh/crikex-prod root@<SERVER_IP>

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y \
  curl \
  wget \
  git \
  docker.io \
  docker-compose \
  htop \
  tmux \
  nginx

# Add user to docker group
usermod -aG docker ubuntu

# Start Docker
systemctl start docker
systemctl enable docker

# Verify Docker
docker --version
docker-compose --version
```

---

## 🏗️ Infrastructure Setup

### Step 5: SSL Certificate

```bash
# Using Let's Encrypt with Certbot
apt install -y certbot python3-certbot-nginx

# Generate certificate
certbot certonly --standalone \
  -d api.crikex.app \
  -d crikex.app \
  --email admin@crikex.app \
  -n \
  --agree-tos

# Certificate will be at:
/etc/letsencrypt/live/api.crikex.app/fullchain.pem
/etc/letsencrypt/live/api.crikex.app/privkey.pem

# Auto-renewal
certbot renew --dry-run
```

### Step 6: Directory Structure

```bash
# Create application directories
mkdir -p /var/www/crikex-api
mkdir -p /var/log/crikex
mkdir -p /var/backups/crikex

# Create SSL directory
mkdir -p /var/www/crikex-api/certs
cp /etc/letsencrypt/live/api.crikex.app/fullchain.pem /var/www/crikex-api/certs/crikex.crt
cp /etc/letsencrypt/live/api.crikex.app/privkey.pem /var/www/crikex-api/certs/crikex.key

# Set permissions
chown -R app:app /var/www/crikex-api
chown -R app:app /var/log/crikex
chmod 755 /var/www/crikex-api/certs
chmod 644 /var/www/crikex-api/certs/*
```

---

## 📦 Deploy Application

### Step 7: Clone Repository

```bash
cd /var/www/crikex-api

# Clone repository
git clone https://github.com/yourusername/crikex.git .

# Verify files
ls -la
cat FINAL_SUMMARY.md
```

### Step 8: Configure Environment

```bash
# Create .env.production
cat > .env.production << 'EOF'
# Server
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://api.crikex.app

# Database
DATABASE_URL=postgresql://crikex_user:${DB_PASSWORD}@postgres:5432/crikex
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0

# Authentication
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION=7d
SESSION_SECRET=$(openssl rand -base64 32)

# Razorpay
RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}

# Monitoring
SENTRY_DSN=${SENTRY_DSN}
DD_AGENT_HOST=datadog-agent

# Feature Flags
FEATURE_ANALYTICS=true
ROLLOUT_ANALYTICS=100
FEATURE_CONTESTS=true
ROLLOUT_CONTESTS=100
EOF

# Set secure permissions
chmod 600 .env.production

# Verify configuration
cat .env.production
```

### Step 9: Build & Start Containers

```bash
# Build Docker images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Verify containers are running
docker-compose -f docker-compose.prod.yml ps

# Expected output:
# NAME                     STATUS
# crikex-api              Up 2 minutes (healthy)
# crikex-postgres         Up 2 minutes (healthy)
# crikex-redis            Up 2 minutes (healthy)
# crikex-nginx            Up 1 minute
```

### Step 10: Run Database Migrations

```bash
# Execute migrations inside container
docker-compose -f docker-compose.prod.yml exec api npm run migrate:latest

# Verify migration completed
docker-compose -f docker-compose.prod.yml exec postgres psql -U crikex_user -d crikex -c "\dt"
```

---

## ✅ Verification & Testing

### Step 11: Health Checks

```bash
# Check API health
curl -k https://api.crikex.app/api/health

# Expected response:
# {"status":"ok","service":"crikex-api","version":"1.0.0","uptime":...}

# Check endpoint connectivity
curl -k https://api.crikex.app/api/v1/predictions/available

# Check database
curl -k https://api.crikex.app/api/v1/wallet \
  -H "Authorization: Bearer test-token"
```

### Step 12: View Logs

```bash
# API logs
docker-compose -f docker-compose.prod.yml logs -f api

# Database logs
docker-compose -f docker-compose.prod.yml logs -f postgres

# Redis logs
docker-compose -f docker-compose.prod.yml logs -f redis

# Nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Step 13: Run Tests

```bash
# E2E tests against production
API_URL=https://api.crikex.app npm run test:e2e

# Load tests against production
API_URL=https://api.crikex.app npm run test:load:staging

# Expect results to show:
# ✓ Requests: 100+
# ✓ Error rate: <10%
# ✓ p95 response: <500ms
```

---

## 📊 Monitoring Setup

### Step 14: Enable Monitoring

**Sentry Setup:**
```bash
# Configure Sentry DSN in .env.production
SENTRY_DSN=https://<key>@sentry.io/<project-id>

# Verify Sentry is collecting errors
curl -k https://api.crikex.app/api/v1/invalid-endpoint

# Check Sentry dashboard for logged errors
```

**DataDog Setup:**
```bash
# Install DataDog agent on server
DD_AGENT_MAJOR_VERSION=7 DD_API_KEY=${DATADOG_API_KEY} \
DD_SITE="datadoghq.com" bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_agent.sh)"

# Verify agent is running
sudo service datadog-agent status

# Configure Docker metrics
docker-compose -f docker-compose.prod.yml logs api | grep "dd-trace"
```

### Step 15: Configure Alerts

```bash
# Alert rules in Sentry dashboard:
1. Error rate > 5% → Page on-call
2. Performance degradation > 20% → Notify Slack
3. Database connection errors → Page on-call

# Alert rules in DataDog:
1. CPU > 80% → Notify Slack
2. Memory > 80% → Notify Slack
3. Response time p95 > 1000ms → Create incident
```

---

## 🔄 Backup & Disaster Recovery

### Step 16: Setup Automated Backups

```bash
# Create backup script
cat > /usr/local/bin/backup-crikex.sh << 'EOF'
#!/bin/bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/crikex"
mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f /var/www/crikex-api/docker-compose.prod.yml \
  exec -T postgres pg_dump -U crikex_user crikex | gzip > $BACKUP_DIR/db_$BACKUP_DATE.sql.gz

# Redis backup
docker-compose -f /var/www/crikex-api/docker-compose.prod.yml \
  exec -T redis redis-cli --rdb /data/redis_$BACKUP_DATE.rdb

# Upload to S3 (if configured)
aws s3 cp $BACKUP_DIR/db_$BACKUP_DATE.sql.gz \
  s3://crikex-backups/$BACKUP_DATE/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -type f -mtime +30 -delete

echo "Backup completed: $BACKUP_DATE"
EOF

# Make executable
chmod +x /usr/local/bin/backup-crikex.sh

# Add to cron (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-crikex.sh >> /var/log/crikex/backup.log 2>&1" | \
  crontab -
```

### Step 17: Test Backup Recovery

```bash
# Restore database from backup
DB_FILE="/var/backups/crikex/db_latest.sql.gz"

# Stop API to prevent writes
docker-compose -f docker-compose.prod.yml stop api

# Restore database
gunzip < $DB_FILE | \
  docker-compose -f docker-compose.prod.yml \
  exec -T postgres psql -U crikex_user crikex

# Start API
docker-compose -f docker-compose.prod.yml start api

# Verify restoration
curl -k https://api.crikex.app/api/health
```

---

## 🎯 Post-Deployment Checklist

### Week 1: Daily Monitoring

- [ ] Check error rate (target: < 1%)
- [ ] Monitor response times (p95 < 500ms)
- [ ] Verify database performance
- [ ] Review user registrations
- [ ] Monitor payment processing
- [ ] Check fraud detection flags
- [ ] Verify backup completion

### Week 2-4: Ongoing Operations

- [ ] Weekly performance review
- [ ] Update dependencies if needed
- [ ] Optimize slow queries
- [ ] Review support tickets
- [ ] Collect usage metrics
- [ ] Plan optimizations

### Success Criteria

```
✓ API uptime: >99.9%
✓ Response time p95: <500ms
✓ Error rate: <1%
✓ User registrations: Growing steadily
✓ Zero critical security incidents
✓ All tests passing
✓ Backups completed daily
```

---

## 📞 Troubleshooting

### Issue: Container won't start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs api

# Common causes:
# 1. Port already in use
sudo lsof -i :3000

# 2. Environment variables missing
docker-compose -f docker-compose.prod.yml config | grep variables

# 3. Database connection failed
docker-compose -f docker-compose.prod.yml exec api ping postgres
```

### Issue: Database connection errors

```bash
# Verify database is running
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check database credentials
docker-compose -f docker-compose.prod.yml exec postgres psql \
  -U crikex_user -d crikex -c "SELECT 1"

# Check connection pool
docker-compose -f docker-compose.prod.yml logs postgres | grep pool
```

### Issue: High error rate

```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs -f api

# Check fraud detection flags
curl -k https://api.crikex.app/api/v1/admin/feature-status

# Check rate limiting
curl -s https://api.crikex.app/api/v1/auth/send-otp -X POST -d '{}' | head -20
```

---

## 🎉 Deployment Complete!

**Your CrikeX production deployment is now live!**

Monitor dashboard: https://datadog.com/crikex  
Error tracking: https://sentry.io/crikex  
Health check: https://api.crikex.app/api/health

**Ready for users! 🎯**
