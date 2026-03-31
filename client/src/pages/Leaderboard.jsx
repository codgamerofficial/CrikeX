import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Target, Flame } from 'lucide-react';

export default function Leaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeaderboard('period=season&periodKey=IPL-2026')
      .then(data => { setEntries(data.entries || []); setUserRank(data.userRank); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div className="container page-pad">
      <div className="page-top anim-in">
        <h1>🏆 Leaderboard</h1>
        <p>IPL 2026 Season Rankings — Top predictors win prizes!</p>
      </div>

      {/* Podium */}
      {entries.length >= 3 && (
        <div className="lb-podium anim-in anim-d1">
          {[entries[1], entries[0], entries[2]].map((e, i) => {
            const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
            return (
              <div key={e.id} className={`lb-podium-item ${rank === 1 ? 'first' : ''}`}
                   style={{ height: rank === 1 ? 200 : rank === 2 ? 170 : 150 }}>
                <div className="lb-medal">{medals[rank]}</div>
                <div className="lb-name">{e.username}</div>
                <div className="lb-pts">{e.points.toLocaleString()} pts</div>
                <div className="lb-meta">
                  <span><Target size={10} /> {e.predictionsWon}W</span>
                  <span><Flame size={10} /> {e.streak}🔥</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User rank card */}
      {userRank && (
        <div className="neo-card anim-in anim-d2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>🎯</span>
            <span style={{ fontWeight: 600 }}>Your Rank</span>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem' }}>#{userRank.rank}</span>
            <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{userRank.points.toLocaleString()} pts</span>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? <div className="spinner" /> : (
        <div className="glass-card anim-in anim-d3" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="lb-table">
            <thead>
              <tr><th>Rank</th><th>Player</th><th>Points</th><th>Won</th><th>Streak</th></tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className={e.userId === user?.id ? 'lb-you-row' : ''}>
                  <td>
                    {e.rank <= 3 ? (
                      <span className={`lb-rank-badge lb-rank-${e.rank}`}>{e.rank}</span>
                    ) : <span className="lb-rank">{e.rank}</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {e.username}
                    {e.userId === user?.id && <span className="badge badge-green" style={{ marginLeft: 8 }}>YOU</span>}
                  </td>
                  <td className="lb-pts-cell">{e.points.toLocaleString()}</td>
                  <td>{e.predictionsWon}</td>
                  <td className="lb-streak">{e.streak > 0 ? `${e.streak} 🔥` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
