import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Shield, LogOut, CheckCircle, AlertCircle, Users } from 'lucide-react';

export default function Profile() {
  const { user, logout, setShowAuth } = useAuth();
  const navigate = useNavigate();
  const [kycForm, setKycForm] = useState({ panNumber: '', fullName: '', dob: '', aadhaarLast4: '' });
  const [kycMsg, setKycMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!user) return (
    <div className="container page-pad">
      <div className="empty-box"><div className="empty-ico">🔒</div><h3>Login Required</h3>
        <button className="btn btn-primary" onClick={() => setShowAuth(true)} style={{ marginTop: 16 }}>Start Winning</button>
      </div>
    </div>
  );

  const handleKycSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true); setKycMsg('');
    try { await api.submitKyc(kycForm); setKycMsg('✅ KYC submitted! Verification in progress...'); }
    catch (err) { setKycMsg(`❌ ${err.message || 'Failed'}`); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="container page-pad" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-top anim-in"><h1>👤 Profile</h1></div>

      {/* User card */}
      <div className="profile-hero anim-in anim-d1">
        <div className="profile-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
        <div>
          <div className="profile-name">{user.username}</div>
          <div className="profile-phone">{user.phone}</div>
          <div style={{ marginTop: 4 }}>
            <span className={`badge ${user.role === 'premium' ? 'badge-gold' : 'badge-blue'}`}>
              {user.role === 'premium' ? '⭐ Premium' : '🎮 Free'}
            </span>
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="stats-grid anim-in anim-d2">
        <div className="stat-tile">
          <div className="stat-tile-label">State</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>{user.stateCode}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label">KYC</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            {user.kycStatus === 'verified' ? <CheckCircle size={14} style={{ color: 'var(--win)' }} /> : <AlertCircle size={14} style={{ color: 'var(--gold)' }} />}
            <span style={{ fontWeight: 600, color: user.kycStatus === 'verified' ? 'var(--win)' : 'var(--gold)', textTransform: 'capitalize', fontSize: '0.85rem' }}>{user.kycStatus}</span>
          </div>
        </div>
      </div>

      {/* KYC Form */}
      {user.kycStatus !== 'verified' && (
        <div className="liquid-glass anim-in anim-d3" style={{ marginTop: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, position: 'relative', zIndex: 1 }}>
            <Shield size={18} style={{ color: 'var(--blue)' }} /> KYC Verification
          </h3>
          <form onSubmit={handleKycSubmit} style={{ position: 'relative', zIndex: 1 }}>
            <div className="field">
              <label>Full Name (as on PAN)</label>
              <input type="text" value={kycForm.fullName} onChange={e => setKycForm(p => ({ ...p, fullName: e.target.value }))} placeholder="Virat Kohli" required />
            </div>
            <div className="field">
              <label>PAN Number</label>
              <input type="text" value={kycForm.panNumber} onChange={e => setKycForm(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" maxLength={10} required />
            </div>
            <div className="field">
              <label>Date of Birth</label>
              <input type="date" value={kycForm.dob} onChange={e => setKycForm(p => ({ ...p, dob: e.target.value }))} required />
            </div>
            <div className="field">
              <label>Aadhaar Last 4 Digits</label>
              <input type="text" value={kycForm.aadhaarLast4} onChange={e => setKycForm(p => ({ ...p, aadhaarLast4: e.target.value }))} placeholder="1234" maxLength={4} />
            </div>
            {kycMsg && <p style={{ fontSize: '0.8rem', marginBottom: 10, color: kycMsg.startsWith('✅') ? 'var(--win)' : 'var(--loss)' }}>{kycMsg}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit KYC'}
            </button>
          </form>
        </div>
      )}

      {/* Referral */}
      <div className="neo-card anim-in" style={{ marginTop: 16, cursor: 'pointer' }} onClick={() => navigate('/referral')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Refer & Earn</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Invite friends and earn 1,000 coins each</div>
            </div>
          </div>
          <span style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>→</span>
        </div>
      </div>

      {/* Responsible Gaming */}
      <div className="clay-card anim-in anim-d4" style={{ marginTop: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 10 }}>🎮 Responsible Gaming</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 14 }}>
          CrikeX is free-to-play. No real money involved. Need help? Contact iCALL helpline.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button className="btn btn-secondary btn-sm">⏸ Self-Exclude</button>
          <button className="btn btn-secondary btn-sm">📊 Set Limits</button>
          <button className="btn btn-secondary btn-sm">📞 Helpline</button>
          <button className="btn btn-secondary btn-sm">📄 Terms</button>
        </div>
      </div>

      {/* Logout */}
      <button className="btn btn-danger btn-block anim-in" onClick={logout} style={{ marginTop: 16, marginBottom: 40 }}>
        <LogOut size={16} /> Logout
      </button>
    </div>
  );
}
