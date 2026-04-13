# CrikeX Feature Rollout & Migration Guide

**Version 1.0** | Last Updated: April 14, 2026

---

## 📋 Table of Contents

1. [Feature Flags](#feature-flags)
2. [Rollout Strategies](#rollout-strategies)
3. [Database Migrations](#database-migrations)
4. [Backwards Compatibility](#backwards-compatibility)
5. [Rollback Procedures](#rollback-procedures)
6. [Communication Plan](#communication-plan)

---

## 🚩 Feature Flags

All new features controlled via feature flags in `.env`:

```env
# Features
FEATURE_2FA=true
FEATURE_WITHDRAWALS=true
FEATURE_RESPONSIBLE_GAMING=true
FEATURE_ANALYTICS=false
FEATURE_CONTESTS=false
FEATURE_LIVE_COMMENTARY=false

# Gradual Rollout Percentages (0-100)
ROLLOUT_ANALYTICS=0
ROLLOUT_CONTESTS=0
ROLLOUT_CAMPAIGNS=0
```

### Implementation in Code

```javascript
// middleware/featureFlags.js
export function isFeatureEnabled(featureName, userId) {
  const enabledFeatures = process.env[`FEATURE_${featureName.toUpperCase()}`];
  
  if (enabledFeatures === 'true') return true;
  if (enabledFeatures === 'false') return false;
  
  // Gradual rollout: hash userId for consistent assignment
  const rolloutPercentage = parseInt(
    process.env[`ROLLOUT_${featureName.toUpperCase()}`] || 0
  );
  
  const userHash = hashCode(userId) % 100;
  return userHash < rolloutPercentage;
}

// Use in routes
router.get('/analytics', (req, res) => {
  if (!isFeatureEnabled('ANALYTICS', req.user.id)) {
    return res.status(404).json({ error: 'FEATURE_NOT_AVAILABLE' });
  }
  // Return analytics data
});
```

---

## 📊 Rollout Strategies

### Strategy 1: Canary Release (Safest)

```
Week 1: Enable for 5% of users (Core team + early users)
├─ Monitor error rates, performance
├─ Gather user feedback
└─ Fix critical issues

Week 2: Roll out to 10% of users
├─ Expand to specific regions
└─ Monitor metrics

Week 3: Roll out to 50% of users
└─ Monitor for any regression

Week 4: 100% Launch
```

**ROLLOUT_ANALYTICS progression:**
```env
# Day 1
ROLLOUT_ANALYTICS=5

# Day 4
ROLLOUT_ANALYTICS=10

# Day 8
ROLLOUT_ANALYTICS=50

# Day 15
ROLLOUT_ANALYTICS=100
```

### Strategy 2: Geographic Rollout

```
Phase 1: Western India
├─ Mumbai, Pune, Bangalore
└─ Monitor performance

Phase 2: Northern India
├─ Delhi, Jaipur
└─ Expand

Phase 3: Southern India
├─ Chennai, Hyderabad
└─ Expand

Phase 4: Nationwide
```

**Implementation:**

```javascript
export function isFeatureAvailableInRegion(featureName, stateCode) {
  const enabledRegions = process.env[`FEATURE_${featureName}_REGIONS`]
    ?.split(',') || [];
  return enabledRegions.includes(stateCode);
}
```

### Strategy 3: Time-Based Release

```
Monday 09:00 AM: Enable for 10% (Business hours only)
│
Wednesday 09:00 AM: Analysis + 25%
│
Friday 09:00 AM: Analysis + 50%
│
Monday 09:00 AM: Full rollout
```

---

## 🗄️ Database Migrations

### Safe Migration Pattern

#### Step 1: Add New Column (Backwards Compatible)

```sql
-- Migration: 001_add_analytics_table.sql
ALTER TABLE users
ADD COLUMN analytics_preferences JSON DEFAULT '{}',
ADD COLUMN analytics_opt_in BOOLEAN DEFAULT false;

-- No downtime, backwards compatible
-- Old code still works
```

#### Step 2: Dual Write (Transition Period)

```javascript
// During rollout period, write to both old and new locations
async function updateUserAnalytics(userId, data) {
  // Write to old location (keep working)
  await db.query('UPDATE users SET preferences = ? WHERE id = ?', [data, userId]);
  
  // Write to new location
  if (isFeatureEnabled('ANALYTICS', userId)) {
    await db.query(
      'UPDATE users SET analytics_preferences = ? WHERE id = ?',
      [data, userId]
    );
  }
}
```

#### Step 3: Read from New Location (If Enabled)

```javascript
async function getUserAnalytics(userId) {
  if (isFeatureEnabled('ANALYTICS', userId)) {
    return db.query(
      'SELECT analytics_preferences FROM users WHERE id = ?',
      [userId]
    );
  }
  
  // Fall back to old location
  return db.query(
    'SELECT preferences FROM users WHERE id = ?',
    [userId]
  );
}
```

#### Step 4: Backfill Data

```bash
# Migration: 002_backfill_analytics_data.sql
# Run during low-traffic hours

UPDATE users
SET analytics_preferences = preferences
WHERE analytics_preferences IS NULL
  AND preferences IS NOT NULL;
```

#### Step 5: Remove Old Column

```sql
-- Migration: 003_remove_old_preferences.sql
-- Only after all code uses new location

ALTER TABLE users
DROP COLUMN preferences;
```

### Migration Checklist

```
1. Add new schema ✓
   └─ Backwards compatible, nullable
2. Deploy code with dual write ✓
   └─ Read old, write both
3. Monitor errors/performance ✓
   └─ 24-48 hours
4. Backfill data ✓
   └─ Non-blocking, low priority
5. Deploy code reading from new ✓
   └─ Fallback to old still present
6. Monitor 24 hours ✓
   └─ Zero errors
7. Remove old column ✓
   └─ Keep in code for 1 version
```

---

## 🔄 Backwards Compatibility

### API Versioning

```javascript
// Support multiple API versions
app.use('/api/v1', v1Routes);  // Legacy
app.use('/api/v2', v2Routes);  // New features

// V1: Old endpoint (keep forever)
router.get('/v1/predictions', (req, res) => {
  // Return in old format for backwards compatibility
  res.json({ predictions: [...] });
});

// V2: Enhanced endpoint
router.get('/v2/predictions', (req, res) => {
  // Return with new fields, analytics, etc.
  res.json({
    predictions: [...],
    analytics: { ... },
    recommended: [...],
  });
});
```

### Client-Side Handling

```javascript
// client/services/api.js
async function getPredictions() {
  try {
    // Try new endpoint first
    const response = await fetch('/api/v2/predictions');
    if (response.status === 404) {
      // Fall back to v1
      return fetch('/api/v1/predictions');
    }
    return response;
  } catch (error) {
    // Fallback handling
    return getPredictionsV1();
  }
}
```

---

## 🔙 Rollback Procedures

### Quick Rollback (5 minutes)

**If critical issue detected:**

```bash
# Method 1: Feature Flag Disable (Fastest)
# Edit .env
FEATURE_ANALYTICS=false

# Restart server
docker restart crikex-api

# Confirm health
curl https://api.crikex.app/health
```

### Full Rollback (15 minutes)

```bash
# Method 2: Docker Rollback
# Revert to previous image

docker pull registry.example.com/crikex:api-v1.0.5
docker stop crikex-api
docker rm crikex-api
docker-compose up -d

# Run database rollback
docker-compose exec api npm run migrate:rollback
```

### Database Rollback

```bash
# List migrations
npm run migrate:status

# Rollback specific migration
npm run migrate:rollback -- --step 3

# Verify data integrity
npm run db:verify
```

---

## 📢 Communication Plan

### Pre-Launch (1 Week Before)

**Announce on:**
- In-app notification banner
- Email newsletter
- Social media
- In-app help docs

**Message:** "Exciting new features coming next week!"

### Launch Day (5% Rollout)

**Internal Communication:**
- Slack notification to team
- Sentry alerts configured
- On-call engineer assigned
- Monitoring dashboards live

**User Communication:**
- Beta testers get notification
- In-app "New Feature" badge
- Help docs available

### Escalation Week 1-2

**Monitoring:**
```
✓ Error rate < 1%
✓ API response time p95 < 500ms
✓ User feedback positive
✓ Zero critical bugs
```

**Go/No-Go Checklist:**

```yaml
Technical:
  - [ ] Error rate < 1%
  - [ ] Performance normal
  - [ ] No data loss
  - [ ] All metrics green

User Feedback:
  - [ ] 90% positive feedback
  - [ ] No critical bugs
  - [ ] Feature working as expected

Business:
  - [ ] Product owner approval
  - [ ] Legal review complete
  - [ ] Customer support trained
```

### Full Launch Communication

**To Users:**
```
📢 New Feature Launch: Advanced Analytics

We're excited to introduce Analytics Dashboard!
- Track your prediction performance
- Analyze winning patterns
- Get personalized recommendations

Learn more: [link to docs]
```

---

## 📊 Feature: Advanced Analytics Rollout Plan

### Timeline: 6 Weeks

### Week 1: Planning & Preparation
```
✓ Database migrations
✓ Backend analytics service
✓ APIs ready
✓ Feature flag: ROLLOUT_ANALYTICS=5
```

### Week 2-3: Canary (5% → 10%)
```
Day 1-2: Deploy to staging
Day 3-4: 5% real users (team)
Day 5-6: Gather feedback
Day 7: Expand to 10%

Metrics to monitor:
├─ Error rate (target: < 0.1%)
├─ Response time (target: p95 < 300ms)
├─ User feedback (target: 9/10)
└─ Data accuracy (target: 99.9%)
```

### Week 3-4: Limited Release (10% → 50%)
```
Day 1-3: 10% users (multi-region)
Day 4-5: Feedback & improvements
Day 6-7: Expand to 50%

Focus:
├─ Edge case handling
├─ Performance optimization
└─ Bug fixes
```

### Week 5: Expansion (50% → 90%)
```
Day 1-4: 50% users
Day 5-7: Expand to 90%

Focus:
├─ Marketing materials ready
├─ Help docs complete
├─ Customer support trained
└─ Monitoring tuned
```

### Week 6: Full Launch (90% → 100%)
```
Day 1: Final QA
Day 2-3: 100% rollout
Day 4-7: Monitoring & support

Post-Launch:
├─ Weekly performance reviews
├─ Monthly roadmap updates
└─ Feedback collection
```

---

## 📊 Feature: Contests Rollout Plan

### Complexity: High (Database, Frontend, Real-time)

### Pre-Launch Preparation

```
Database:
├─ Contests table
├─ Contest_users table
├─ Contest_bets table
└─ Contest_leaderboard table (materialized view)

Backend:
├─ Contest creation API
├─ Contest join API
├─ Leaderboard calculation
├─ Real-time updates (WebSocket)
└─ Settlement engine

Frontend:
├─ Contest discovery page
├─ Contest detail page
├─ Contest leaderboard
└─ Join/participate UI
```

### Rollout Timeline: 4 Weeks

```
Week 1: Internal Testing (0%)
├─ Staging environment only
├─ Team plays contests
└─ Bug fixes & improvements

Week 2: Beta (5%)
├─ Early adopters
├─ Invite-only contests
└─ Collect feedback

Week 3: Limited Release (25%)
├─ Specific contest types
├─ Regional rollout
└─ Monitor for issues

Week 4: Full Release (100%)
├─ All contest types
├─ Nationwide
└─ Marketing push
```

### Go/No-Go Criteria for Each Stage

```
Week 1→2: Quality Gate
✓ All manual tests pass
✓ No data corruption
✓ Performance acceptable

Week 2→3: User Feedback Gate
✓ 8/10 average satisfaction
✓ <5 critical bugs
✓ Positive sentiment

Week 3→4: Performance Gate
✓ Error rate < 0.5%
✓ Response time p95 < 500ms
✓ Leaderboard updates < 5s
```

---

## 🔍 Monitoring During Rollout

### Key Metrics Dashboard

```
Real-time Monitoring:
├─ Feature adoption rate
├─ Error rate by feature
├─ API response time
├─ User engagement
├─ Support tickets increase
└─ Revenue impact

Alerts Configured:
├─ Error rate > 5% → Immediate page
├─ Response time p95 > 1s → Alert
├─ User complaints surge → Alert
└─ Feature flag issues → Alert
```

### Daily Rollout Report Template

```markdown
## Daily Rollout Report - Feature: Analytics

**Date:** 2026-04-15

### Metrics
- Active Users (Feature): 1,250 (5%)
- Error Rate: 0.3% ✓
- Response Time p95: 280ms ✓
- User Satisfaction: 4.2/5 ✓

### Feedback
- ✓ Users finding the feature
- ✓ Performance excellent
- ⚠ One UI bug (minor)
- ✓ Help docs effective

### Issues
None critical

### Recommendation
Proceed with 10% rollout tomorrow
```

---

## Emergency Procedures

### If Error Rate > 5%

```
IMMEDIATE:
1. Alert on-call engineer
2. Set FEATURE_ANALYTICS = false (if critical)
3. Check error logs
4. Rollback to previous version if needed

THEN:
1. Root cause analysis
2. Fix & test
3. Deploy again carefully
4. Monitor closely
```

### If Performance Degraded

```
IMMEDIATE:
1. Check database performance
2. Check cache hit rates
3. Scale horizontally if needed
4. Consider disabling feature

THEN:
1. Optimize queries
2. Add indexes
3. Improve caching
4. Test again
```

---

## ✅ Checklist for Every Feature Rollout

```
Pre-Launch:
[ ] Code reviewed & merged
[ ] Tests passing (100% coverage target)
[ ] Staging deployed & tested
[ ] Database migrations verified
[ ] Feature flag configured
[ ] Monitoring & alerts ready
[ ] Rollback plan documented
[ ] Team trained

Launch:
[ ] Deploy to production
[ ] Feature flag: Low percentage
[ ] Monitor for 24 hours
[ ] Check error logs
[ ] Gather user feedback
[ ] Daily go/no-go meeting

Post-Launch:
[ ] Monitor for 1 week
[ ] Collect feedback
[ ] Optimize based on data
[ ] Document lessons learned
[ ] Plan next feature rollout
```

---

**For questions on rollout procedures, contact:** DevOps Team or refer to the emergency contacts doc.

