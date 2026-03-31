import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Trophy } from 'lucide-react';

export default function TopBar() {
  const { user, wallet, setShowAuth } = useAuth();
  const { pathname } = useLocation();
  const isActive = (p) => pathname === p ? 'active' : '';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="topbar-logo">
          <div className="logo-mark">CX</div>
          <span>Crike<span className="logo-accent">X</span></span>
        </Link>

        <nav className="topbar-nav">
          <Link to="/matches" className={isActive('/matches')}><Zap size={14} /> Matches</Link>
          <Link to="/leaderboard" className={isActive('/leaderboard')}><Trophy size={14} /> Leaderboard</Link>
        </nav>

        <div className="topbar-right">
          {user && wallet && (
            <Link to="/wallet" className="wallet-pill">
              <span className="w-icon">🪙</span>
              <span className="w-amount">{(wallet.coinsBalance || 0).toLocaleString()}</span>
            </Link>
          )}
          {user ? (
            <Link to="/profile" className="user-avatar">
              {user.username.slice(0, 2).toUpperCase()}
            </Link>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAuth(true)}>
              Start Winning
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
