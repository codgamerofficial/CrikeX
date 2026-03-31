// ═══════════════════════════════════════════════════════════════
// CrikeX — Fraud Detection Engine
// ═══════════════════════════════════════════════════════════════

import logger from '../utils/logger.js';
import redis from './redis.js';

// Risk thresholds
const THRESHOLDS = {
  VELOCITY_1MIN: 10,        // max predictions in 1 min
  VELOCITY_1HR: 50,         // max predictions in 1 hr
  HIGH_STAKE_THRESHOLD: 3000,
  WIN_RATE_ANOMALY: 0.85,   // 85%+ win rate is suspicious
  RAPID_FIRE_MS: 2000,      // predictions faster than 2s apart
  MAX_DAILY_PREDICTIONS: 100,
  COLLUSION_CORRELATION: 0.90,
  MULTI_ACCOUNT_IP_LIMIT: 3,
};

export class FraudDetectionService {
  constructor() {
    this.alertCallbacks = [];
  }

  // ── Main Analysis ──
  async analyzePrediction(userId, prediction, context = {}) {
    const risks = [];
    const scores = [];

    // 1. Velocity Check
    const velocity = await this.checkVelocity(userId);
    if (velocity.risk > 0) {
      risks.push({ type: 'velocity', ...velocity });
      scores.push(velocity.risk);
    }

    // 2. Stake Size Analysis
    const stakeRisk = this.analyzeStakeSize(prediction, context);
    if (stakeRisk.risk > 0) {
      risks.push({ type: 'stake_anomaly', ...stakeRisk });
      scores.push(stakeRisk.risk);
    }

    // 3. Win Rate Analysis
    const winRateRisk = await this.analyzeWinRate(userId, context);
    if (winRateRisk.risk > 0) {
      risks.push({ type: 'win_rate_anomaly', ...winRateRisk });
      scores.push(winRateRisk.risk);
    }

    // 4. Timing Analysis
    const timingRisk = await this.analyzeTimingPattern(userId);
    if (timingRisk.risk > 0) {
      risks.push({ type: 'rapid_fire', ...timingRisk });
      scores.push(timingRisk.risk);
    }

    // 5. IP / Device Check
    const deviceRisk = await this.checkDeviceFingerprint(userId, context);
    if (deviceRisk.risk > 0) {
      risks.push({ type: 'multi_account', ...deviceRisk });
      scores.push(deviceRisk.risk);
    }

    // Calculate composite risk score (0 to 1)
    const compositeScore = scores.length > 0
      ? Math.min(1, scores.reduce((a, b) => a + b, 0) / scores.length + (scores.length > 3 ? 0.2 : 0))
      : 0;

    const decision = this.makeDecision(compositeScore);

    if (compositeScore > 0.3) {
      logger.security('Fraud analysis triggered', {
        userId, compositeScore: compositeScore.toFixed(3), decision, riskCount: risks.length,
      });
    }

    return { compositeScore, decision, risks, timestamp: new Date() };
  }

  // ── Velocity Check ──
  async checkVelocity(userId) {
    const key1m = `fraud:velocity:1m:${userId}`;
    const key1h = `fraud:velocity:1h:${userId}`;

    const count1m = await redis.incr(key1m);
    if (count1m === 1) await redis.set(key1m, 1, 60);

    const count1h = await redis.incr(key1h);
    if (count1h === 1) await redis.set(key1h, 1, 3600);

    let risk = 0;
    let message = '';
    if (count1m > THRESHOLDS.VELOCITY_1MIN) {
      risk = 0.7;
      message = `${count1m} predictions in 1 min (limit: ${THRESHOLDS.VELOCITY_1MIN})`;
    } else if (count1h > THRESHOLDS.VELOCITY_1HR) {
      risk = 0.5;
      message = `${count1h} predictions in 1 hr (limit: ${THRESHOLDS.VELOCITY_1HR})`;
    }

    return { risk, count1m, count1h, message };
  }

  // ── Stake Size Analysis ──
  analyzeStakeSize(prediction, context) {
    const { coinsStaked } = prediction;
    const userBalance = context.walletBalance || 10000;
    const avgStake = context.avgStake || 200;

    let risk = 0;
    let message = '';

    // Betting disproportionately to balance
    if (coinsStaked > userBalance * 0.5) {
      risk = 0.4;
      message = `Staking ${((coinsStaked / userBalance) * 100).toFixed(0)}% of balance`;
    }

    // Betting much higher than average
    if (avgStake > 0 && coinsStaked > avgStake * 5) {
      risk = Math.max(risk, 0.5);
      message = `Stake ${coinsStaked} is ${(coinsStaked / avgStake).toFixed(1)}x their average`;
    }

    // Very high stake
    if (coinsStaked >= THRESHOLDS.HIGH_STAKE_THRESHOLD) {
      risk = Math.max(risk, 0.3);
      message = `High stake: ${coinsStaked} coins`;
    }

    return { risk, coinsStaked, avgStake, message };
  }

  // ── Win Rate Analysis ──
  async analyzeWinRate(userId, context) {
    const totalPreds = context.totalPredictions || 0;
    const wonPreds = context.wonPredictions || 0;

    if (totalPreds < 20) return { risk: 0, message: 'Insufficient data' };

    const winRate = wonPreds / totalPreds;
    let risk = 0;
    let message = '';

    if (winRate > THRESHOLDS.WIN_RATE_ANOMALY) {
      risk = 0.8;
      message = `Anomalous win rate: ${(winRate * 100).toFixed(1)}% over ${totalPreds} predictions`;
    } else if (winRate > 0.70) {
      risk = 0.3;
      message = `Elevated win rate: ${(winRate * 100).toFixed(1)}%`;
    }

    return { risk, winRate, totalPreds, wonPreds, message };
  }

  // ── Timing Pattern ──
  async analyzeTimingPattern(userId) {
    const key = `fraud:lastPred:${userId}`;
    const lastTime = await redis.get(key);
    const now = Date.now();
    await redis.set(key, now, 600);

    if (!lastTime) return { risk: 0, message: 'First prediction in window' };

    const gap = now - lastTime;
    let risk = 0;
    let message = '';

    if (gap < THRESHOLDS.RAPID_FIRE_MS) {
      risk = 0.6;
      message = `Rapid predictions: ${gap}ms gap (min: ${THRESHOLDS.RAPID_FIRE_MS}ms)`;
    }

    return { risk, gapMs: gap, message };
  }

  // ── Device Fingerprint ──
  async checkDeviceFingerprint(userId, context) {
    const { ip, deviceId } = context;
    if (!ip) return { risk: 0, message: 'No IP data' };

    const ipKey = `fraud:ip:${ip}`;
    const existingUsers = (await redis.get(ipKey)) || [];

    if (!existingUsers.includes(userId)) {
      existingUsers.push(userId);
      await redis.set(ipKey, existingUsers, 86400);
    }

    let risk = 0;
    let message = '';
    if (existingUsers.length > THRESHOLDS.MULTI_ACCOUNT_IP_LIMIT) {
      risk = 0.7;
      message = `${existingUsers.length} accounts from same IP (limit: ${THRESHOLDS.MULTI_ACCOUNT_IP_LIMIT})`;
    }

    return { risk, accountsOnIp: existingUsers.length, message };
  }

  // ── Decision Engine ──
  makeDecision(score) {
    if (score >= 0.8) return 'block';
    if (score >= 0.6) return 'flag_and_limit';
    if (score >= 0.4) return 'flag';
    if (score >= 0.2) return 'monitor';
    return 'allow';
  }

  // ── Collusion Detection ──
  async detectCollusion(userId, matchId, selection, allPredictions) {
    // Find users with identical prediction patterns
    const userPreds = allPredictions.filter(p => p.matchId === matchId && p.selection === selection);
    const userMap = {};
    userPreds.forEach(p => {
      if (!userMap[p.userId]) userMap[p.userId] = 0;
      userMap[p.userId]++;
    });

    // If 3+ users make identical patterns across multiple markets
    const coordinated = Object.entries(userMap).filter(([_, count]) => count >= 3);
    if (coordinated.length >= 3) {
      logger.security('Potential collusion detected', {
        matchId, selection, coordinatedUsers: coordinated.length,
      });
      return { detected: true, userCount: coordinated.length };
    }

    return { detected: false };
  }
}

export const fraudService = new FraudDetectionService();
export default fraudService;
