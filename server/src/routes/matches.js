import { Router } from 'express';
import { matches, markets } from '../data/store.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/matches
router.get('/', optionalAuth, (req, res) => {
  const { sport, league, status } = req.query;
  let result = [...matches];
  if (sport) result = result.filter(m => m.sport === sport);
  if (league) result = result.filter(m => m.league.toLowerCase().includes(league.toLowerCase()));
  if (status) result = result.filter(m => m.status === status);
  result.sort((a, b) => {
    const order = { live: 0, upcoming: 1, completed: 2, cancelled: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || new Date(a.startTime) - new Date(b.startTime);
  });
  res.json({ success: true, matches: result, total: result.length });
});

// GET /api/v1/matches/:id
router.get('/:id', optionalAuth, (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  const matchMarkets = markets.filter(mk => mk.matchId === match.id);
  res.json({ success: true, match, markets: matchMarkets });
});

// GET /api/v1/matches/:id/markets
router.get('/:id/markets', (req, res) => {
  const matchMarkets = markets.filter(mk => mk.matchId === req.params.id);
  res.json({ success: true, markets: matchMarkets });
});

// GET /api/v1/matches/:id/scorecard
router.get('/:id/scorecard', (req, res) => {
  const match = matches.find(m => m.id === req.params.id);
  if (!match) return res.status(404).json({ error: 'MATCH_NOT_FOUND' });
  res.json({ success: true, matchId: match.id, scoreData: match.scoreData, status: match.status });
});

export default router;
