import { Router } from 'express';
import { leaderboardEntries } from '../data/store.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/leaderboard
router.get('/', optionalAuth, (req, res) => {
  const { period = 'season', periodKey = 'IPL-2026' } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  let entries = leaderboardEntries.filter(e => e.period === period && e.periodKey === periodKey);
  entries.sort((a, b) => b.points - a.points);
  entries = entries.slice(0, limit);

  let userRank = null;
  if (req.user) {
    const userEntry = leaderboardEntries.find(e => e.userId === req.user.id && e.period === period && e.periodKey === periodKey);
    if (userEntry) userRank = { ...userEntry };
  }

  res.json({ success: true, entries, userRank, total: entries.length });
});

export default router;
