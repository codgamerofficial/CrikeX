import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="container page-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 200px)', textAlign: 'center' }}>
      <div className="anim-in" style={{ marginBottom: 32 }}>
        <div style={{ fontSize: '6rem', marginBottom: 8, opacity: 0.3 }}>🏏</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 10vw, 6rem)', fontWeight: 900, lineHeight: 1, background: 'linear-gradient(135deg, #00FFB2, #00D4FF)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          404
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, marginTop: 12, marginBottom: 8 }}>
          Bowled Out!
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 400, margin: '0 auto' }}>
          Looks like this page went for a duck. The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <div className="anim-in anim-d1" style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Go Back
        </button>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <Home size={16} /> Home
        </button>
      </div>
    </div>
  );
}
