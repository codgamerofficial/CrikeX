import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useBetSlip } from '../components/FloatingBetSlip';
import { ArrowLeft, Zap, BarChart3, MessageSquare } from 'lucide-react';

const TEAM_COLORS = {
  CSK: '#FFCB05', MI: '#004BA0', RCB: '#D4213D', KKR: '#3A225D',
  DC: '#004C93', SRH: '#FF822A', RR: '#EA1A85', PBKS: '#DD1F2D',
  GT: '#1B2133', LSG: '#A72056',
};

export default function MatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, setShowAuth } = useAuth();
  const { addSelection, selections } = useBetSlip();
  const [match, setMatch] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [tab, setTab] = useState('odds');
  const [commentary, setCommentary] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    api.getMatch(id).then(data => { setMatch(data.match); setMarkets(data.markets || []); }).catch(() => navigate('/matches'));

    const socket = io({ transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.emit('join_match', { matchId: id });

    socket.on('score_update', ({ matchId, scoreData, event }) => {
      if (matchId !== id) return;
      setMatch(prev => prev ? { ...prev, scoreData } : prev);
      if (event) setCommentary(prev => [{ ...event, time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }, ...prev].slice(0, 30));
    });

    socket.on('odds_update', ({ matchId, marketId, options }) => {
      if (matchId !== id) return;
      setMarkets(prev => prev.map(mk => mk.id === marketId ? { ...mk, options } : mk));
    });

    return () => { socket.emit('leave_match', { matchId: id }); socket.disconnect(); };
  }, [id, navigate]);

  const handleOddsClick = (market, option) => {
    if (!user) { setShowAuth(true); return; }
    addSelection({
      marketId: market.id,
      key: option.key,
      label: option.label,
      odds: option.odds,
      matchInfo: `${match.teamA} vs ${match.teamB}`,
      marketDesc: market.description,
    });
  };

  const isSelected = (marketId, key) => selections.some(s => s.marketId === marketId && s.key === key);

  if (!match) return <div className="container page-pad"><div className="spinner" /></div>;

  const sd = match.scoreData || {};

  return (
    <div className="container page-pad">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/matches')} style={{ marginBottom: 14 }}>
        <ArrowLeft size={16} /> Back
      </button>

      {/* Match Hero */}
      <div className="md-hero anim-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <span className="match-league">{match.league}</span>
          <span className={`match-status-badge ${match.status}`}>
            {match.status === 'live' && <span className="live-dot" />}
            {match.status.toUpperCase()}
          </span>
        </div>

        <div className="md-teams-row" style={{ position: 'relative', zIndex: 1 }}>
          <div className="md-team">
            <div className="team-crest" style={{ background: TEAM_COLORS[match.teamA] || '#333' }}>{match.teamA}</div>
            <div className="team-label">{match.teamAData?.name || match.teamA}</div>
            {sd.teamA && <div className="team-score-lg">{sd.teamA.runs}/{sd.teamA.wickets}</div>}
            {sd.teamA && <div className="team-overs">({sd.teamA.overs} ov)</div>}
          </div>
          <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 700 }}>VS</span>
          <div className="md-team">
            <div className="team-crest" style={{ background: TEAM_COLORS[match.teamB] || '#333' }}>{match.teamB}</div>
            <div className="team-label">{match.teamBData?.name || match.teamB}</div>
            {sd.teamB && <div className="team-score-lg">{sd.teamB.runs}/{sd.teamB.wickets}</div>}
            {sd.teamB && <div className="team-overs">({sd.teamB.overs} ov)</div>}
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', position: 'relative', zIndex: 1 }}>📍 {match.venue}</div>
      </div>

      {/* Tabs */}
      <div className="tab-strip anim-in anim-d1" style={{ marginBottom: 20, alignSelf: 'start' }}>
        <button className={`tab-item ${tab === 'odds' ? 'active' : ''}`} onClick={() => setTab('odds')}>
          <Zap size={13} /> Odds
        </button>
        <button className={`tab-item ${tab === 'stats' ? 'active' : ''}`} onClick={() => setTab('stats')}>
          <BarChart3 size={13} /> Stats
        </button>
        <button className={`tab-item ${tab === 'commentary' ? 'active' : ''}`} onClick={() => setTab('commentary')}>
          <MessageSquare size={13} /> Live
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'odds' && (
        <div className="anim-in">
          {markets.filter(mk => mk.status === 'open' || mk.status === 'suspended').map(market => (
            <div key={market.id} className="market-panel">
              <div className="market-label">
                {market.status === 'suspended' ? '⏸' : '⚡'} {market.description}
              </div>
              <div className="market-grid">
                {market.options.map(opt => (
                  <div
                    key={opt.key}
                    className={`odds-btn ${isSelected(market.id, opt.key) ? 'selected' : ''}`}
                    onClick={() => market.status === 'open' && handleOddsClick(market, opt)}
                    style={market.status === 'suspended' ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                  >
                    <span className="odds-team">{opt.label}</span>
                    <span className="odds-value">{opt.odds.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'stats' && (
        <div className="anim-in">
          <div className="stats-grid">
            <div className="stat-tile"><div className="stat-tile-label">Run Rate</div><div className="stat-tile-value green">{sd.teamA ? (sd.teamA.runs / Math.max(1, sd.teamA.overs)).toFixed(2) : '0.00'}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Wickets</div><div className="stat-tile-value red">{sd.teamA?.wickets || 0}/{sd.teamB?.wickets || 0}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Projected</div><div className="stat-tile-value gold">{sd.teamA ? Math.round((sd.teamA.runs / Math.max(1, sd.teamA.overs)) * 20) : '—'}</div></div>
            <div className="stat-tile"><div className="stat-tile-label">Partnership</div><div className="stat-tile-value blue">{sd.teamA ? Math.floor(Math.random() * 60) + 12 : '—'}</div></div>
          </div>

          <div className="glass-card" style={{ marginTop: 12 }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 14 }}>📊 Head to Head</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, textAlign: 'center' }}>
              <div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>14</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{match.teamA} Wins</div></div>
              <div style={{ borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', padding: '0 16px' }}><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>32</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Matches</div></div>
              <div><div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>18</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{match.teamB} Wins</div></div>
            </div>
          </div>

          <div className="glass-card" style={{ marginTop: 12 }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 14 }}>🏟️ Venue Stats</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
              <div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem' }}>172</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg 1st Inn</div></div>
              <div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--win)' }}>52%</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Chase Win%</div></div>
              <div><div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--gold)' }}>45</div><div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Matches</div></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'commentary' && (
        <div className="anim-in">
          {commentary.length === 0 ? (
            <div className="empty-box"><div className="empty-ico">📢</div><h3>No commentary yet</h3><p>Live updates will appear here during the match</p></div>
          ) : (
            <div className="commentary-feed">
              {commentary.map((c, i) => (
                <div key={i} className="commentary-row">
                  <span className="commentary-ts">{c.time}</span>
                  <span className={`commentary-txt ${c.type || ''}`}>{c.commentary}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
