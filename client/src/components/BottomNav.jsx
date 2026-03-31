import { Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
  const { pathname } = useLocation();
  const isActive = (p) => pathname === p ? 'active' : '';

  return (
    <nav className="bottom-nav">
      <Link to="/matches" className={isActive('/matches')}>
        <span className="nav-icon">🏏</span>
        Home
      </Link>
      <Link to="/leaderboard" className={isActive('/leaderboard')}>
        <span className="nav-icon">🏆</span>
        Rank
      </Link>
      <Link to="/wallet" className={isActive('/wallet')}>
        <span className="nav-icon">💰</span>
        Wallet
      </Link>
      <Link to="/profile" className={isActive('/profile')}>
        <span className="nav-icon">👤</span>
        Profile
      </Link>
    </nav>
  );
}
