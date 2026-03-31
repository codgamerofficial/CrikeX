import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Shield, Trophy, TrendingUp, Users, BarChart3 } from 'lucide-react';

export default function Landing() {
  const { user, setShowAuth } = useAuth();
  const navigate = useNavigate();

  const features = [
    { icon: <Zap size={22} />, title: 'Live Predictions', desc: 'Predict on live IPL matches with real-time odds updating every ball.' },
    { icon: <Trophy size={22} />, title: 'Win Rewards', desc: 'Climb the leaderboard and win brand-sponsored prizes. No real money.' },
    { icon: <Shield size={22} />, title: '100% Legal', desc: 'Fully compliant with Indian laws. Free-to-play prediction platform.' },
    { icon: <TrendingUp size={22} />, title: 'AI Odds Engine', desc: 'ML-powered odds that shift in real-time based on match events.' },
    { icon: <Users size={22} />, title: 'Compete with Friends', desc: 'Create private leagues and prove you know cricket best.' },
    { icon: <BarChart3 size={22} />, title: 'Deep Analytics', desc: 'Stats, head-to-head records, and venue analysis for smarter picks.' },
  ];

  const steps = [
    { icon: '📱', step: '01', title: 'Sign Up Free', desc: 'Create account with your phone. Get 10,000 free coins!' },
    { icon: '🏏', step: '02', title: 'Pick a Match', desc: 'Browse live & upcoming IPL matches with real-time odds.' },
    { icon: '🎯', step: '03', title: 'Make Predictions', desc: 'Predict match winner, top scorer, total runs and more.' },
    { icon: '🏆', step: '04', title: 'Win Rewards', desc: 'Top the leaderboard to win sponsored prizes!' },
  ];

  return (
    <>
      <section className="landing-hero">
        <span className="float-emoji">🏏</span>
        <span className="float-emoji">⚡</span>
        <span className="float-emoji">🏆</span>

        <div className="hero-inner container">
          <div className="hero-pill">
            <Zap size={14} /> IPL 2026 Season is LIVE
          </div>

          <h1 className="hero-h1">
            Predict. Play.<br />
            <span className="neon">Win Big with IPL.</span>
          </h1>

          <p className="hero-p">
            India's smartest sports prediction platform. Make free predictions
            on IPL matches, climb the leaderboard, and win amazing rewards.
          </p>

          <div className="hero-btns">
            <button className="btn btn-primary btn-xl" onClick={() => user ? navigate('/matches') : setShowAuth(true)}>
              <Zap size={18} /> Start Winning
            </button>
            <button className="btn btn-secondary btn-xl" onClick={() => navigate('/leaderboard')}>
              <Trophy size={18} /> Leaderboard
            </button>
          </div>

          <div className="hero-stats">
            <div><div className="hero-stat-val">2.5M+</div><div className="hero-stat-lbl">Predictors</div></div>
            <div><div className="hero-stat-val">₹12Cr+</div><div className="hero-stat-lbl">Rewards</div></div>
            <div><div className="hero-stat-val">50+</div><div className="hero-stat-lbl">Markets</div></div>
            <div><div className="hero-stat-val">4.8★</div><div className="hero-stat-lbl">Rating</div></div>
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 0', background: 'var(--bg-primary)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800 }}>
              Why <span style={{ color: 'var(--primary)' }}>CrikeX</span>?
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 6, maxWidth: 400, margin: '6px auto 0' }}>
              Built by cricket lovers, for cricket lovers.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {features.map((f, i) => (
              <div key={i} className="glass-card anim-in" style={{ animationDelay: `${i * 0.06}s` }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: 14 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 800 }}>How It Works</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, maxWidth: 960, margin: '0 auto' }}>
            {steps.map((s, i) => (
              <div key={i} className="clay-card anim-in" style={{ textAlign: 'center', animationDelay: `${i * 0.08}s` }}>
                <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: 2, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>STEP {s.step}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>{s.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '60px 0', background: 'var(--bg-primary)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, marginBottom: 12 }}>
            Ready to test your <span className="neon">Cricket IQ</span>?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: '1rem' }}>
            Join 2.5 million fans making predictions on every ball.
          </p>
          <button className="btn btn-primary btn-xl" onClick={() => user ? navigate('/matches') : setShowAuth(true)}>
            <Zap size={18} /> Start Now — It's Free
          </button>
          <p style={{ marginTop: 14, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            🔒 100% free to play · No real money · Legal in India
          </p>
        </div>
      </section>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          © 2026 CrikeX. Free-to-play prediction platform. Not a gambling service.
        </p>
      </footer>
    </>
  );
}
