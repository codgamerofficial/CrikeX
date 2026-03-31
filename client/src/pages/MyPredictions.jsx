import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Target, TrendingUp, Clock, CheckCircle, XCircle, Filter } from 'lucide-react';
import { SkeletonList } from '../components/Skeleton';

export default function MyPredictions() {
  const { user, setShowAuth } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.getMyPredictions()
      .then(d => setPredictions(d.predictions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return (
    <div className="container page-pad">
      <div className="empty-box"><div className="empty-ico">🔒</div><h3>Login Required</h3><p>Sign in to view your predictions</p>
        <button className="btn btn-primary" onClick={() => setShowAuth(true)} style={{ marginTop: 16 }}>Start Winning</button>
      </div>
    </div>
  );

  const filtered = filter === 'all' ? predictions : predictions.filter(p => p.status === filter);
  const wonCount = predictions.filter(p => p.status === 'won').length;
  const lostCount = predictions.filter(p => p.status === 'lost').length;
  const activeCount = predictions.filter(p => p.status === 'active').length;
  const totalStaked = predictions.reduce((acc, p) => acc + (p.coinsStaked || 0), 0);
  const totalWon = predictions.filter(p => p.status === 'won').reduce((acc, p) => acc + (p.payout || 0), 0);
  const winRate = predictions.length > 0 ? Math.round((wonCount / predictions.length) * 100) : 0;

  const statusIcon = (s) => {
    if (s === 'won') return <CheckCircle size={14} style={{ color: '#00FFB2' }} />;
    if (s === 'lost') return <XCircle size={14} style={{ color: '#FF4B6E' }} />;
    return <Clock size={14} style={{ color: '#FFB800' }} />;
  };

  return (
    <div className="container page-pad">
      <div className="page-top anim-in">
        <h1 className="page-title"><Target size={24} /> My Predictions</h1>
        <p className="page-sub">Track your prediction performance</p>
      </div>

      {/* Stats Row */}
      <div className="stats-grid anim-in anim-d1" style={{ marginBottom: 20 }}>
        <div className="card stat-card">
          <span className="stat-label">Win Rate</span>
          <span className="stat-value" style={{ color: '#00FFB2' }}>{winRate}%</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Total Bets</span>
          <span className="stat-value">{predictions.length}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Total Staked</span>
          <span className="stat-value">🪙 {totalStaked.toLocaleString()}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Total Won</span>
          <span className="stat-value" style={{ color: '#00FFB2' }}>🪙 {totalWon.toLocaleString()}</span>
        </div>
      </div>

      {/* Filter Row */}
      <div className="filter-row anim-in anim-d2" style={{ marginBottom: 20 }}>
        {[
          { id: 'all', label: `All (${predictions.length})` },
          { id: 'active', label: `Active (${activeCount})` },
          { id: 'won', label: `Won (${wonCount})` },
          { id: 'lost', label: `Lost (${lostCount})` },
        ].map(f => (
          <button key={f.id} className={`filter-chip ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Predictions List */}
      {loading ? <SkeletonList count={5} /> : filtered.length === 0 ? (
        <div className="empty-box anim-in">
          <div className="empty-ico">🎯</div>
          <h3>{filter === 'all' ? 'No predictions yet' : `No ${filter} predictions`}</h3>
          <p>Go to matches and start predicting!</p>
          <button className="btn btn-primary" onClick={() => navigate('/matches')} style={{ marginTop: 16 }}>
            <TrendingUp size={16} /> Browse Matches
          </button>
        </div>
      ) : (
        <div className="anim-in anim-d3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => (
            <div key={p.id} className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => navigate(`/matches/${p.matchId}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {statusIcon(p.status)}
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.marketTitle || p.marketId}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Pick: <strong style={{ color: 'var(--text-primary)' }}>{p.selection}</strong> @ <strong>{p.oddsAtPlacement?.toFixed(2)}</strong>
                  </div>
                </div>
                <span className={`badge ${p.status === 'won' ? 'badge-success' : p.status === 'lost' ? 'badge-live' : 'badge-warning'}`}>
                  {p.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>Staked: 🪙 {p.coinsStaked?.toLocaleString()}</span>
                {p.payout > 0 && <span style={{ color: '#00FFB2', fontWeight: 700 }}>Won: 🪙 {p.payout?.toLocaleString()}</span>}
                <span>{new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
