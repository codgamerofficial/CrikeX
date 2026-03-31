import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { MapPin, ChevronRight, TrendingUp, Zap } from 'lucide-react';

const TEAM_COLORS = {
  CSK: '#FFCB05', MI: '#004BA0', RCB: '#D4213D', KKR: '#3A225D',
  DC: '#004C93', SRH: '#FF822A', RR: '#EA1A85', PBKS: '#DD1F2D',
  GT: '#1B2133', LSG: '#A72056',
};

const TRENDING_BETS = [
  { text: '🔥 Virat Kohli 50+ runs', odds: '1.80' },
  { text: '⚡ Next wicket under 5 overs', odds: '2.10' },
  { text: '🏏 CSK to hit most sixes', odds: '2.40' },
  { text: '🎯 First ball boundary', odds: '3.50' },
];

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return 'Live';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function MatchCard({ match }) {
  const navigate = useNavigate();
  const sd = match.scoreData || {};

  return (
    <div className={`match-card ${match.status}`} onClick={() => navigate(`/matches/${match.id}`)}>
      <div className="match-header">
        <span className="match-league">{match.league}</span>
        <span className={`match-status-badge ${match.status}`}>
          {match.status === 'live' && <span className="live-dot" />}
          {match.status === 'live' ? 'LIVE' : match.status === 'upcoming' ? 'UPCOMING' : 'DONE'}
        </span>
      </div>

      <div className="match-teams">
        <div className="team-block">
          <div className="team-crest" style={{ background: TEAM_COLORS[match.teamA] || '#333' }}>
            {match.teamA}
          </div>
          <div className="team-label">{match.teamAData?.name || match.teamA}</div>
          {sd.teamA && <>
            <div className="team-score-lg">{sd.teamA.runs}/{sd.teamA.wickets}</div>
            <div className="team-overs">({sd.teamA.overs} ov)</div>
          </>}
        </div>

        <div className="match-vs-block">
          <span className="match-vs-time">{match.status === 'upcoming' ? formatTime(match.startTime) : 'VS'}</span>
        </div>

        <div className="team-block">
          <div className="team-crest" style={{ background: TEAM_COLORS[match.teamB] || '#333' }}>
            {match.teamB}
          </div>
          <div className="team-label">{match.teamBData?.name || match.teamB}</div>
          {sd.teamB && <>
            <div className="team-score-lg">{sd.teamB.runs}/{sd.teamB.wickets}</div>
            <div className="team-overs">({sd.teamB.overs} ov)</div>
          </>}
        </div>
      </div>

      <div className="odds-row">
        <div className="odds-btn">
          <span className="odds-team">{match.teamA}</span>
          <span className="odds-value">{match.status === 'live' ? '1.85' : '1.92'}</span>
        </div>
        <div className="odds-btn">
          <span className="odds-team">{match.teamB}</span>
          <span className="odds-value">{match.status === 'live' ? '2.10' : '1.95'}</span>
        </div>
      </div>

      <div className="match-footer">
        <span><MapPin size={11} /> {match.venue?.split(',')[0]}</span>
        <span style={{ color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          Predict <ChevronRight size={14} />
        </span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState('all');
  const [cat, setCat] = useState('cricket');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMatches().then(data => { setMatches(data.matches || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? matches : matches.filter(m => m.status === filter);
  const liveCount = matches.filter(m => m.status === 'live').length;
  const upcomingCount = matches.filter(m => m.status === 'upcoming').length;

  return (
    <div className="container page-pad">
      {/* Stats Row */}
      <div className="stats-grid anim-in">
        <div className="stat-tile">
          <div className="stat-tile-label">Live Now</div>
          <div className="stat-tile-value green">{liveCount}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Upcoming</div>
          <div className="stat-tile-value blue">{upcomingCount}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Matches</div>
          <div className="stat-tile-value gold">{matches.length}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">Markets</div>
          <div className="stat-tile-value red">12</div>
        </div>
      </div>

      {/* Category Scroll */}
      <div className="cat-scroll anim-in anim-d1">
        {[{ key: 'cricket', emoji: '🏏', label: 'Cricket' }, { key: 'football', emoji: '⚽', label: 'Football' }, { key: 'kabaddi', emoji: '🤼', label: 'Kabaddi' }, { key: 'tennis', emoji: '🎾', label: 'Tennis' }].map(c => (
          <button key={c.key} className={`cat-pill ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="section-head anim-in anim-d2">
        <h2><Zap size={18} style={{ color: 'var(--primary)' }} /> Matches</h2>
        <div className="tab-strip">
          {['all', 'live', 'upcoming', 'completed'].map(f => (
            <button key={f} className={`tab-item ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Match Cards */}
      {loading ? <div className="spinner" /> : filtered.length === 0 ? (
        <div className="empty-box"><div className="empty-ico">🏏</div><h3>No matches found</h3><p>Check back soon!</p></div>
      ) : (
        <div className="matches-grid anim-in anim-d3">
          {filtered.map(m => <MatchCard key={m.id} match={m} />)}
        </div>
      )}

      {/* Trending Bets */}
      <div style={{ marginTop: 28 }} className="anim-in anim-d4">
        <div className="section-head">
          <h2><TrendingUp size={18} style={{ color: 'var(--gold)' }} /> Trending Bets</h2>
        </div>
        <div className="trending-list">
          {TRENDING_BETS.map((bet, i) => (
            <div key={i} className="trending-item">
              <span className="trending-text">{bet.text}</span>
              <span className="trending-odds">{bet.odds}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
