import { Routes, Route } from 'react-router-dom';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import AuthModal from './components/AuthModal';
import FloatingBetSlip, { BetSlipProvider } from './components/FloatingBetSlip';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import MatchDetail from './pages/MatchDetail';
import Wallet from './pages/Wallet';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Referral from './pages/Referral';
import NotFound from './pages/NotFound';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { loading, showAuth, setShowAuth } = useAuth();

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <BetSlipProvider>
      <div className="app-layout">
        <TopBar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/matches" element={<Dashboard />} />
            <Route path="/matches/:id" element={<MatchDetail />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <BottomNav />
        <FloatingBetSlip />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    </BetSlipProvider>
  );
}
