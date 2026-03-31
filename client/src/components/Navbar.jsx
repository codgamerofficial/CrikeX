import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Trophy, BarChart3, Wallet, User, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const { user, wallet, setShowAuth } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">CX</div>
          <span>Crike<span className="logo-x">X</span></span>
        </Link>

        <ul className="navbar-nav">
          <li><Link to="/matches" className={isActive('/matches')}><Zap size={16} /> Matches</Link></li>
          <li><Link to="/leaderboard" className={isActive('/leaderboard')}><Trophy size={16} /> Leaderboard</Link></li>
          {user && <li><Link to="/wallet" className={isActive('/wallet')}><Wallet size={16} /> Wallet</Link></li>}
          {user && <li><Link to="/profile" className={isActive('/profile')}><User size={16} /> Profile</Link></li>}
        </ul>

        <div className="navbar-right">
          {user && wallet && (
            <Link to="/wallet" className="coin-badge">
              <span className="coin-icon">🪙</span>
              <span>{(wallet.coinsBalance || 0).toLocaleString()}</span>
            </Link>
          )}
          {user ? (
            <Link to="/profile" className="btn btn-secondary btn-sm">
              <User size={14} /> {user.username}
            </Link>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAuth(true)}>
              Get Started
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
