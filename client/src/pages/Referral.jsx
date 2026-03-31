import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Copy, CheckCircle, Share2, Users, Gift, TrendingUp } from 'lucide-react';

const REFERRAL_REWARDS = [
  { milestone: 1, reward: '1,000 coins', icon: '🎁' },
  { milestone: 5, reward: '5,000 coins + Badge', icon: '🏅' },
  { milestone: 10, reward: '10,000 coins + VIP', icon: '👑' },
  { milestone: 25, reward: '25,000 coins + Merch', icon: '🎽' },
  { milestone: 50, reward: '50,000 coins + Premium', icon: '💎' },
];

export default function Referral() {
  const { user, setShowAuth } = useAuth();
  const [referral, setReferral] = useState(null);
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState('');
  const [applyMsg, setApplyMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    fetch('/api/v1/referrals/my', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('crikex_token')}` }
    })
      .then(r => r.json())
      .then(data => setReferral(data.referral))
      .catch(() => {});
  }, [user]);

  if (!user) return (
    <div className="container page-pad">
      <div className="empty-box"><div className="empty-ico">🔒</div><h3>Login Required</h3>
        <button className="btn btn-primary" onClick={() => setShowAuth(true)} style={{ marginTop: 16 }}>Start Winning</button>
      </div>
    </div>
  );

  const code = referral?.code || 'LOADING';
  const link = referral?.link || '#';
  const referred = referral?.referredCount || 0;
  const earned = referral?.totalEarned || 0;

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join CrikeX!',
        text: `Use my referral code ${code} and get 500 free coins! 🏏`,
        url: link,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`Join CrikeX and predict IPL matches! Use my code ${code} to get 500 free coins. ${link}`);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = async () => {
    if (!applyCode.trim()) return;
    setApplyMsg('');
    try {
      const res = await fetch('/api/v1/referrals/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('crikex_token')}` },
        body: JSON.stringify({ referralCode: applyCode }),
      });
      const data = await res.json();
      if (res.ok) setApplyMsg(`✅ ${data.message}`);
      else setApplyMsg(`❌ ${data.message || data.error}`);
    } catch { setApplyMsg('❌ Failed to apply code'); }
  };

  return (
    <div className="container page-pad" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-top anim-in">
        <h1>🤝 Refer & Earn</h1>
        <p>Share CrikeX with friends to earn bonus coins!</p>
      </div>

      {/* Stats */}
      <div className="stats-grid anim-in anim-d1">
        <div className="stat-tile">
          <div className="stat-tile-label"><Users size={12} /> Referred</div>
          <div className="stat-tile-value green">{referred}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-label"><Gift size={12} /> Earned</div>
          <div className="stat-tile-value gold">{earned.toLocaleString()} 🪙</div>
        </div>
      </div>

      {/* Referral Code Card */}
      <div className="liquid-glass anim-in anim-d2" style={{ marginTop: 16, textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 8, position: 'relative', zIndex: 1 }}>
          Your Referral Code
        </h3>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: 'var(--primary)',
          letterSpacing: 4, padding: '16px 0', position: 'relative', zIndex: 1,
          textShadow: '0 0 30px rgba(0,255,178,0.3)'
        }}>
          {code}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <button className="btn btn-primary btn-sm" onClick={copyCode}>
            {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy Code</>}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={shareLink}>
            <Share2 size={14} /> Share Link
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="glass-card anim-in anim-d3" style={{ marginTop: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 14 }}>
          <TrendingUp size={18} style={{ color: 'var(--primary)' }} /> How Referrals Work
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { step: '1', text: 'Share your unique code with friends' },
            { step: '2', text: 'Friend signs up & enters your code' },
            { step: '3', text: 'You get 1,000 🪙 · Friend gets 500 🪙' },
          ].map(s => (
            <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem',
                flexShrink: 0,
              }}>{s.step}</div>
              <span style={{ fontSize: '0.9rem' }}>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div className="neo-card anim-in anim-d4" style={{ marginTop: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 14 }}>🎯 Referral Milestones</h3>
        {REFERRAL_REWARDS.map(m => (
          <div key={m.milestone} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>{m.icon}</span>
              <span style={{ fontWeight: 600 }}>{m.milestone} referrals</span>
            </div>
            <span className={`badge ${referred >= m.milestone ? 'badge-green' : 'badge-blue'}`}>
              {referred >= m.milestone ? '✅ ' : ''}{m.reward}
            </span>
          </div>
        ))}
      </div>

      {/* Have a code? */}
      <div className="clay-card anim-in" style={{ marginTop: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 10 }}>🎟️ Have a Referral Code?</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="stake-input"
            placeholder="Enter code"
            value={applyCode}
            onChange={e => setApplyCode(e.target.value.toUpperCase())}
            style={{ flex: 1, fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}
          />
          <button className="btn btn-primary" onClick={handleApply}>Apply</button>
        </div>
        {applyMsg && <p style={{ fontSize: '0.8rem', marginTop: 8, color: applyMsg.startsWith('✅') ? 'var(--win)' : 'var(--loss)' }}>{applyMsg}</p>}
      </div>

      {/* Referred users */}
      {referral?.referredUsers?.length > 0 && (
        <div className="glass-card anim-in" style={{ marginTop: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 14 }}>👥 Referred Friends</h3>
          {referral.referredUsers.map((ru, i) => (
            <div key={i} className="tx-item">
              <div className="tx-left">
                <div className="tx-icon-wrap credit">👤</div>
                <div>
                  <div className="tx-desc">{ru.username}</div>
                  <div className="tx-time">Joined {new Date(ru.joinedAt).toLocaleDateString('en-IN')}</div>
                </div>
              </div>
              <span className="tx-amt pos">+{ru.bonusEarned} 🪙</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
