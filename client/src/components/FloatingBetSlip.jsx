import { useState, createContext, useContext } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const BetSlipContext = createContext(null);

export function useBetSlip() {
  const ctx = useContext(BetSlipContext);
  if (!ctx) throw new Error('useBetSlip must be inside BetSlipProvider');
  return ctx;
}

export function BetSlipProvider({ children }) {
  const [selections, setSelections] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const addSelection = (sel) => {
    setSelections(prev => {
      const exists = prev.find(s => s.marketId === sel.marketId);
      if (exists) return prev.map(s => s.marketId === sel.marketId ? sel : s);
      return [...prev, sel];
    });
    setIsOpen(true);
  };

  const removeSelection = (marketId) => {
    setSelections(prev => prev.filter(s => s.marketId !== marketId));
  };

  const clearAll = () => { setSelections([]); setIsOpen(false); };

  return (
    <BetSlipContext.Provider value={{ selections, addSelection, removeSelection, clearAll, isOpen, setIsOpen }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export default function FloatingBetSlip() {
  const { selections, removeSelection, clearAll, isOpen, setIsOpen } = useBetSlip();
  const { user, wallet, setShowAuth, refreshWallet } = useAuth();
  const [stakes, setStakes] = useState({});
  const [placing, setPlacing] = useState(false);
  const [msg, setMsg] = useState('');

  const getStake = (marketId) => stakes[marketId] || 100;
  const setStake = (marketId, val) => setStakes(prev => ({ ...prev, [marketId]: Math.max(0, parseInt(val) || 0) }));
  const totalStake = selections.reduce((sum, s) => sum + getStake(s.marketId), 0);
  const totalPayout = selections.reduce((sum, s) => sum + Math.floor(getStake(s.marketId) * s.odds), 0);

  const placeBets = async () => {
    if (!user) { setShowAuth(true); return; }
    setPlacing(true); setMsg('');
    try {
      for (const sel of selections) {
        await api.placePrediction({
          marketId: sel.marketId,
          selection: sel.key,
          coins: getStake(sel.marketId),
        });
      }
      setMsg(`✅ ${selections.length} prediction(s) placed!`);
      refreshWallet();
      setTimeout(() => { clearAll(); setMsg(''); }, 2000);
    } catch (err) {
      setMsg(`❌ ${err.message || 'Failed'}`);
    } finally { setPlacing(false); }
  };

  if (selections.length === 0) return null;

  // Floating button
  if (!isOpen) {
    return (
      <button className="betslip-fab" onClick={() => setIsOpen(true)}>
        🎯
        <span className="fab-badge">{selections.length}</span>
      </button>
    );
  }

  // Panel
  return (
    <div className="betslip-panel open">
      <div className="betslip-handle" />
      <div className="betslip-header">
        <h3>🎯 Bet Slip ({selections.length})</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ color: 'var(--loss)' }}>Clear</button>
          <button className="auth-close" onClick={() => setIsOpen(false)}><X size={16} /></button>
        </div>
      </div>

      <div className="betslip-body">
        {selections.map(sel => (
          <div key={sel.marketId} className="betslip-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <div className="betslip-match">{sel.matchInfo}</div>
                <div className="betslip-selection">{sel.label}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{sel.marketDesc}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="betslip-odds">{sel.odds.toFixed(2)}</span>
                <button onClick={() => removeSelection(sel.marketId)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <input
                type="number"
                className="stake-input"
                value={getStake(sel.marketId)}
                onChange={e => setStake(sel.marketId, e.target.value)}
                placeholder="Stake"
                style={{ fontSize: '1rem', padding: '10px 12px' }}
              />
              <div className="quick-amounts">
                {[50, 100, 500, 1000, 2000].map(v => (
                  <button key={v} className="quick-amt" onClick={() => setStake(sel.marketId, v)}>₹{v}</button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="betslip-footer">
        <div className="payout-row">
          <span className="payout-label">Total Stake</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>🪙 {totalStake.toLocaleString()}</span>
        </div>
        <div className="payout-row" style={{ paddingTop: 0 }}>
          <span className="payout-label">Potential Payout</span>
          <span className="payout-value">🪙 {totalPayout.toLocaleString()}</span>
        </div>

        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', marginBottom: 8, fontSize: '0.85rem',
            background: msg.startsWith('✅') ? 'var(--win-dim)' : 'var(--loss-dim)',
            color: msg.startsWith('✅') ? 'var(--win)' : 'var(--loss)' }}>
            {msg}
          </div>
        )}

        <button className="btn btn-primary btn-block btn-lg" onClick={placeBets} disabled={placing || totalStake === 0}>
          {placing ? 'Placing...' : `Place Bet${selections.length > 1 ? 's' : ''} — 🪙 ${totalStake.toLocaleString()}`}
        </button>

        {user && (
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Balance: 🪙 {(wallet?.coinsBalance || 0).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
