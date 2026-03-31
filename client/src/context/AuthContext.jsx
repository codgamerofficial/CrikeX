import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('crikex_token');
      if (!token) { setLoading(false); return; }
      const { user: u } = await api.getMe();
      setUser(u);
      try {
        const { wallet: w } = await api.getWallet();
        setWallet(w);
      } catch {}
    } catch {
      localStorage.removeItem('crikex_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (otpRef, otp, stateCode) => {
    const data = await api.verifyOtp(otpRef, otp, stateCode);
    localStorage.setItem('crikex_token', data.token);
    setUser(data.user);
    try {
      const { wallet: w } = await api.getWallet();
      setWallet(w);
    } catch {}
    setShowAuth(false);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('crikex_token');
    setUser(null);
    setWallet(null);
  };

  const refreshWallet = async () => {
    try {
      const { wallet: w } = await api.getWallet();
      setWallet(w);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, wallet, loading, showAuth, setShowAuth, login, logout, refreshWallet, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
