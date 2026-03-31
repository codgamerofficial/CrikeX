import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Shield, Users, TrendingUp, Coins, Activity, BarChart3, Settings, RefreshCw, Ban } from 'lucide-react';
import { SkeletonStats, SkeletonList } from '../components/Skeleton';
import api from '../services/api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [userList, setUserList] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [dashRes, usersRes, matchesRes] = await Promise.all([
        api.adminDashboard(),
        api.adminUsers(),
        api.adminMatches(),
      ]);
      setStats(dashRes.dashboard);
      setUserList(usersRes.users || []);
      setMatches(matchesRes.matches || []);
    } catch (err) {
      toast.error('Failed to load admin data: ' + (err.message || 'Unauthorized'));
    } finally {
      setLoading(false);
    }
  }

  async function toggleBlock(userId) {
    try {
      await api.adminBlockUser(userId);
      toast.success('User block status toggled');
      fetchAll();
    } catch (err) {
      toast.error('Failed: ' + (err.message || 'Error'));
    }
  }

  async function changeMatchStatus(matchId, status) {
    try {
      await api.adminMatchStatus(matchId, status);
      toast.success(`Match status changed to ${status}`);
      fetchAll();
    } catch (err) {
      toast.error('Failed: ' + (err.message || 'Error'));
    }
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="container page-pad" style={{ textAlign: 'center', paddingTop: 80 }}>
        <Shield size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700 }}>Admin Access Required</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>You need admin privileges to access this page.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'users', label: 'Users', icon: <Users size={16} /> },
    { id: 'matches', label: 'Matches', icon: <Activity size={16} /> },
  ];

  return (
    <div className="container page-pad">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title"><Shield size={24} /> Admin Panel</h1>
          <p className="page-sub">Platform management & analytics</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="filter-row" style={{ marginBottom: 24 }}>
        {tabs.map(t => (
          <button key={t.id} className={`filter-chip ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="anim-in">
          {loading ? <SkeletonStats count={6} /> : stats && (
            <>
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="card stat-card">
                  <span className="stat-label"><Users size={14} /> Total Users</span>
                  <span className="stat-value">{stats.users?.total?.toLocaleString() || 0}</span>
                </div>
                <div className="card stat-card">
                  <span className="stat-label"><TrendingUp size={14} /> Predictions</span>
                  <span className="stat-value">{stats.predictions?.total?.toLocaleString() || 0}</span>
                </div>
                <div className="card stat-card">
                  <span className="stat-label"><Coins size={14} /> Coins In Circulation</span>
                  <span className="stat-value">{stats.economy?.totalCoinsCirculating?.toLocaleString() || 0}</span>
                </div>
                <div className="card stat-card">
                  <span className="stat-label"><Activity size={14} /> Live Matches</span>
                  <span className="stat-value" style={{ color: 'var(--accent)' }}>{stats.matches?.live || 0}</span>
                </div>
                <div className="card stat-card">
                  <span className="stat-label">🎯 Active Predictions</span>
                  <span className="stat-value">{stats.predictions?.active || 0}</span>
                </div>
                <div className="card stat-card">
                  <span className="stat-label">🏆 Won Predictions</span>
                  <span className="stat-value" style={{ color: '#00FFB2' }}>{stats.predictions?.won || 0}</span>
                </div>
              </div>

              <div className="card" style={{ padding: 20, marginBottom: 16 }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>
                  <Settings size={16} /> Settlement Stats
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Markets Settled</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.settlement?.marketsSettled || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Staked</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{(stats.predictions?.totalStaked || 0).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open Markets</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stats.markets?.active || 0}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="anim-in">
          {loading ? <SkeletonList count={6} /> : (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={thStyle}>User</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>KYC</th>
                    <th style={thStyle}>Balance</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="profile-avatar" style={{ width: 32, height: 32, fontSize: '0.7rem' }}>
                            {u.username.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{u.username}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{u.phone}</td>
                      <td style={tdStyle}>
                        <span className={`badge ${u.kycStatus === 'verified' ? 'badge-success' : u.kycStatus === 'pending' ? 'badge-warning' : 'badge-muted'}`}>
                          {u.kycStatus}
                        </span>
                      </td>
                      <td style={tdStyle}>🪙 {u.coinsBalance?.toLocaleString() || '—'}</td>
                      <td style={tdStyle}>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleBlock(u.id)} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                          <Ban size={12} /> {u.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="anim-in">
          {loading ? <SkeletonList count={4} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {matches.map(m => (
                <div key={m.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{m.teamA?.short} vs {m.teamB?.short}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.tournament} · {m.venue}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${m.status === 'live' ? 'badge-live' : m.status === 'completed' ? 'badge-success' : 'badge-muted'}`}>
                      {m.status}
                    </span>
                    <select
                      style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '0.75rem' }}
                      value={m.status}
                      onChange={(e) => changeMatchStatus(m.id, e.target.value)}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="live">Live</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle = { textAlign: 'left', padding: '12px 16px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle = { padding: '10px 16px', fontSize: '0.85rem' };
