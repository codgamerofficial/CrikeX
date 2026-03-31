import { matches, markets } from '../data/store.js';

// Simulated live score updates for live matches
const CRICKET_EVENTS = ['dot_ball', 'single', 'double', 'triple', 'boundary', 'six', 'wicket', 'wide', 'no_ball'];
const EVENT_WEIGHTS =  [30,         25,       10,       2,        12,         8,     5,        5,       3];

function weightedRandom(events, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < events.length; i++) { r -= weights[i]; if (r <= 0) return events[i]; }
  return events[0];
}

export function setupWebSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    socket.on('join_match', ({ matchId }) => {
      socket.join(`match:${matchId}`);
      const match = matches.find(m => m.id === matchId);
      if (match) socket.emit('match_snapshot', { match, markets: markets.filter(mk => mk.matchId === matchId) });
    });

    socket.on('leave_match', ({ matchId }) => {
      socket.leave(`match:${matchId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  // Simulate live score updates every 8 seconds for live matches
  setInterval(() => {
    matches.filter(m => m.status === 'live').forEach(match => {
      const event = weightedRandom(CRICKET_EVENTS, EVENT_WEIGHTS);
      const sd = match.scoreData;
      const batting = sd.batting === match.teamA ? 'teamA' : 'teamB';

      let runsScored = 0;
      let commentary = '';

      switch (event) {
        case 'dot_ball': commentary = 'Dot ball! Good bowling.'; break;
        case 'single': runsScored = 1; commentary = 'Quick single taken.'; break;
        case 'double': runsScored = 2; commentary = 'Well-run two!'; break;
        case 'triple': runsScored = 3; commentary = 'Three runs, excellent running!'; break;
        case 'boundary': runsScored = 4; commentary = 'FOUR! Brilliant shot to the boundary! 🏏'; break;
        case 'six': runsScored = 6; commentary = 'SIX! Massive hit into the stands! 🔥'; break;
        case 'wicket': sd[batting].wickets = Math.min(10, sd[batting].wickets + 1); commentary = 'WICKET! Big breakthrough! ⚡'; break;
        case 'wide': runsScored = 1; commentary = 'Wide ball, extra run.'; break;
        case 'no_ball': runsScored = 1; commentary = 'No ball! Free hit coming up.'; break;
      }

      sd[batting].runs += runsScored;
      if (event !== 'wide' && event !== 'no_ball') {
        sd[batting].overs = Math.round((sd[batting].overs + 0.1) * 10) / 10;
        if (Math.round(sd[batting].overs * 10) % 10 === 6) sd[batting].overs = Math.floor(sd[batting].overs) + 1;
      }

      const runRate = (sd[batting].runs / (sd[batting].overs || 1)).toFixed(2);

      io.to(`match:${match.id}`).emit('score_update', {
        matchId: match.id, scoreData: sd, timestamp: new Date(),
        event: { type: event, runs: runsScored, commentary, runRate },
      });

      // Update odds based on score
      const matchMarkets = markets.filter(mk => mk.matchId === match.id && mk.status === 'open');
      matchMarkets.forEach(mk => {
        mk.options = mk.options.map(opt => ({
          ...opt,
          odds: Math.max(1.05, +(opt.odds + (Math.random() - 0.5) * 0.15).toFixed(2)),
        }));
        io.to(`match:${match.id}`).emit('odds_update', { matchId: match.id, marketId: mk.id, options: mk.options });
      });
    });
  }, 8000);
}
