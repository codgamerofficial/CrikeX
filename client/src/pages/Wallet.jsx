import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Gift, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export default function WalletPage() {
  const { user, wallet, setShowAuth, refreshWallet } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [tab, setTab] = useState('transactions');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    api.getTransactions().then(d => setTransactions(d.transactions || [])).catch(() => {});
    api.getMyPredictions().then(d => setPredictions(d.predictions || [])).catch(() => {});
  }, [user]);

  if (!user) return (
    <div className="container page-pad">
      <div className="empty-box"><div className="empty-ico">🔒</div><h3>Login Required</h3><p>Sign in to view your wallet</p>
        <button className="btn btn-primary" onClick={() => setShowAuth(true)} style={{ marginTop: 16 }}>Start Winning</button>
      </div>
    </div>
  );

  const handleClaimDaily = async () => {
    setClaiming(true); setClaimMsg('');
    try {
      const data = await api.claimDaily();
      setClaimMsg(`🎉 ${data.message}`);
      refreshWallet();
      api.getTransactions().then(d => setTransactions(d.transactions || []));
    } catch (err) { setClaimMsg(err.message || 'Already claimed today'); }
    finally { setClaiming(false); }
  };

  const wonCount = predictions.filter(p => p.status === 'won').length;
  const activeCount = predictions.filter(p => p.status === 'active').length;
  const winRate = predictions.length > 0 ? Math.round((wonCount / predictions.length) * 100) : 0;

  return (
    <div className="container page-pad">
      {/* Balance Hero */}
      <div className="wallet-hero anim-in">
        <div className="wallet-bal-label" style={{ position: 'relative', zIndex: 1 }}>Coin Balance</div>
        <div className="wallet-bal-value" style={{ position: 'relative', zIndex: 1 }}>🪙 {(wallet?.coinsBalance || 0).toLocaleString()}</div>
        <div className="wallet-actions" style={{ position: 'relative', zIndex: 1 }}>
          <button className="btn btn-primary btn-sm">📥 Deposit</button>
          <button className="btn btn-secondary btn-sm">📤 Withdraw</button>
        </div>
      </div>

      {/* Daily Bonus */}
      <div className="neo-card anim-in anim-d1" style={{ marginTop: 16, textAlign: 'center' }}>
        <Gift size={28} style={{ color: 'var(--gold)' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', margin: '8px 0 4px' }}>Daily Bonus</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 12 }}>Claim 500 free coins every day!</p>
        <button className="btn btn-primary btn-sm" onClick={handleClaimDaily} disabled={claiming}>
          {claiming ? 'Claiming...' : '🎁 Claim Bonus'}
        </button>
        {claimMsg && <p style={{ fontSize: '0.8rem', marginTop: 8, color: claimMsg.startsWith('🎉') ? 'var(--win)' : 'var(--gold)' }}>{claimMsg}</p>}
      </div>

      {/* Stats */}
      <div className="stats-grid anim-in anim-d2" style={{ marginTop: 16 }}>
        <div className="stat-tile"><div className="stat-tile-label">Predictions</div><div className="stat-tile-value blue">{predictions.length}</div></div>
        <div className="stat-tile"><div className="stat-tile-label">Won</div><div className="stat-tile-value green">{wonCount}</div></div>
        <div className="stat-tile"><div className="stat-tile-label">Active</div><div className="stat-tile-value gold">{activeCount}</div></div>
        <div className="stat-tile"><div className="stat-tile-label">Win Rate</div><div className="stat-tile-value" style={{ color: winRate > 50 ? 'var(--win)' : 'var(--loss)' }}>{winRate}%</div></div>
      </div>

      {/* Tabs */}
      <div className="section-head anim-in anim-d3" style={{ marginTop: 20 }}>
        <h2>{tab === 'transactions' ? '📋 Transactions' : '🎯 Predictions'}</h2>
        <div className="tab-strip">
          <button className={`tab-item ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')}>History</button>
          <button className={`tab-item ${tab === 'predictions' ? 'active' : ''}`} onClick={() => setTab('predictions')}>Bets</button>
        </div>
      </div>

      <div className="glass-card anim-in anim-d4" style={{ padding: 0 }}>
        {tab === 'transactions' ? (
          transactions.length === 0 ? (
            <div className="empty-box"><div className="empty-ico">📋</div><h3>No transactions</h3></div>
          ) : (
            <div className="tx-list" style={{ padding: '0 16px' }}>
              {transactions.map(tx => (
                <div key={tx.id} className="tx-item">
                  <div className="tx-left">
                    <div className={`tx-icon-wrap ${tx.type === 'debit' ? 'debit' : tx.type === 'bonus' ? 'bonus' : 'credit'}`}>
                      {tx.type === 'debit' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                    </div>
                    <div>
                      <div className="tx-desc">{tx.description}</div>
                      <div className="tx-time"><Clock size={9} /> {new Date(tx.createdAt).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                  <div className={`tx-amt ${tx.type === 'debit' ? 'neg' : 'pos'}`}>
                    {tx.type === 'debit' ? '-' : '+'}{tx.amount.toLocaleString()} 🪙
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          predictions.length === 0 ? (
            <div className="empty-box"><div className="empty-ico">🎯</div><h3>No predictions</h3>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/matches')} style={{ marginTop: 12 }}>Browse Matches</button>
            </div>
          ) : (
            <div className="tx-list" style={{ padding: '0 16px' }}>
              {predictions.map(p => (
                <div key={p.id} className="tx-item">
                  <div className="tx-left">
                    <div className={`tx-icon-wrap ${p.status === 'won' ? 'credit' : p.status === 'lost' ? 'debit' : 'bonus'}`}>
                      {p.status === 'won' ? '✅' : p.status === 'lost' ? '❌' : '⏳'}
                    </div>
                    <div>
                      <div className="tx-desc">{p.selectionLabel}</div>
                      <div className="tx-time">{p.marketDescription} · <span style={{ fontFamily: 'var(--font-mono)' }}>{p.oddsAtPlace}x</span></div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>🪙 {p.coinsStaked}</div>
                    <span className={`badge badge-${p.status === 'won' ? 'green' : p.status === 'lost' ? 'red' : 'gold'}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
