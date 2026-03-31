// ═══════════════════════════════════════════════════════════════
// CrikeX — Redis Cache Service (In-memory simulation for dev)
// In production, replace with ioredis client
// ═══════════════════════════════════════════════════════════════

import logger from '../utils/logger.js';

class RedisService {
  constructor() {
    this.store = new Map();
    this.ttlTimers = new Map();
    this.pubsubChannels = new Map();
    logger.info('Redis service initialized (in-memory mode)');
  }

  // ── Core Operations ──
  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = null) {
    const item = { value, setAt: Date.now() };
    if (ttlSeconds) {
      item.expiresAt = Date.now() + ttlSeconds * 1000;
      if (this.ttlTimers.has(key)) clearTimeout(this.ttlTimers.get(key));
      this.ttlTimers.set(key, setTimeout(() => this.store.delete(key), ttlSeconds * 1000));
    }
    this.store.set(key, item);
    return 'OK';
  }

  async del(key) {
    if (this.ttlTimers.has(key)) clearTimeout(this.ttlTimers.get(key));
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key) {
    return this.store.has(key) ? 1 : 0;
  }

  async incr(key) {
    const item = this.store.get(key);
    const val = item ? parseInt(item.value, 10) + 1 : 1;
    await this.set(key, val, item?.expiresAt ? Math.ceil((item.expiresAt - Date.now()) / 1000) : null);
    return val;
  }

  // ── Hash Operations ──
  async hset(key, field, value) {
    let hash = (await this.get(key)) || {};
    hash[field] = value;
    await this.set(key, hash);
  }

  async hget(key, field) {
    const hash = await this.get(key);
    return hash ? hash[field] : null;
  }

  async hgetall(key) {
    return (await this.get(key)) || {};
  }

  // ── Sorted Set (Leaderboard) ──
  async zadd(key, score, member) {
    let set = (await this.get(key)) || [];
    set = set.filter(e => e.member !== member);
    set.push({ member, score });
    set.sort((a, b) => b.score - a.score);
    await this.set(key, set);
  }

  async zrevrange(key, start, stop) {
    const set = (await this.get(key)) || [];
    return set.slice(start, stop + 1);
  }

  async zrank(key, member) {
    const set = (await this.get(key)) || [];
    const idx = set.findIndex(e => e.member === member);
    return idx >= 0 ? idx : null;
  }

  // ── Pub/Sub ──
  async publish(channel, message) {
    const subs = this.pubsubChannels.get(channel) || [];
    subs.forEach(cb => cb(message));
    return subs.length;
  }

  async subscribe(channel, callback) {
    if (!this.pubsubChannels.has(channel)) this.pubsubChannels.set(channel, []);
    this.pubsubChannels.get(channel).push(callback);
  }

  // ── Utility ──
  async flushall() {
    this.store.clear();
    this.ttlTimers.forEach(t => clearTimeout(t));
    this.ttlTimers.clear();
  }

  // ── Cache helpers ──
  async cacheGet(key, ttl, fetchFn) {
    let cached = await this.get(key);
    if (cached !== null) return cached;
    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  // ── Rate Limit Check ──
  async checkRateLimit(key, maxRequests, windowSeconds) {
    const count = await this.incr(key);
    if (count === 1) {
      const item = this.store.get(key);
      item.expiresAt = Date.now() + windowSeconds * 1000;
      this.ttlTimers.set(key, setTimeout(() => this.store.delete(key), windowSeconds * 1000));
    }
    return { allowed: count <= maxRequests, remaining: Math.max(0, maxRequests - count), count };
  }
}

export const redis = new RedisService();
export default redis;
