import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X } from 'lucide-react';
import api from '../services/api';

export default function AuthModal({ onClose }) {
  const { login } = useAuth();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('+91');
  const [otpRef, setOtpRef] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const otpRefs = useRef([]);

  const normalizePhone = (raw) => {
    const digits = raw.replace(/[\s\-()]/g, '');
    if (/^\+91\d{10}$/.test(digits)) return digits;
    if (/^91\d{10}$/.test(digits)) return '+' + digits;
    if (/^\d{10}$/.test(digits)) return '+91' + digits;
    return null;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) { setError('Enter a valid 10-digit mobile number'); return; }
    setLoading(true); setError('');
    try {
      const data = await api.sendOtp(normalized);
      setOtpRef(data.otpRef);
      setDevOtp(data.hint_dev || '');
      setStep('otp');
    } catch (err) { setError(err.message || 'Failed to send OTP'); }
    finally { setLoading(false); }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== '')) verifyOtp(newOtp.join(''));
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const verifyOtp = async (otpString) => {
    setLoading(true); setError('');
    try { await login(otpRef, otpString, 'IN-MH'); }
    catch (err) { setError(err.message || 'Invalid OTP'); setOtp(['','','','','','']); otpRefs.current[0]?.focus(); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal">
        <button className="auth-close" onClick={onClose}><X size={16} /></button>

        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>🏏</div>
        </div>

        {step === 'phone' ? (
          <>
            <h2>Welcome to Crike<span style={{ color: 'var(--primary)' }}>X</span></h2>
            <p className="auth-subtitle">Enter your phone number to start winning</p>
            <form onSubmit={handleSendOtp}>
              <div className="field">
                <label>Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" maxLength={13} autoFocus />
              </div>
              {error && <p style={{ color: 'var(--loss)', fontSize: '0.8rem', marginBottom: 10 }}>{error}</p>}
              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              By continuing, you agree to our Terms of Service & Privacy Policy
            </p>
          </>
        ) : (
          <>
            <h2>Verify OTP</h2>
            <p className="auth-subtitle">Enter the 6-digit code sent to {phone}</p>
            {devOtp && (
              <div style={{ textAlign: 'center', padding: '6px 10px', background: 'var(--win-dim)', borderRadius: 'var(--radius-md)', marginBottom: 14, fontSize: '0.75rem', color: 'var(--win)' }}>
                Dev OTP: <strong style={{ fontFamily: 'var(--font-mono)' }}>{devOtp}</strong>
              </div>
            )}
            <div className="otp-row">
              {otp.map((digit, i) => (
                <input key={i} ref={el => otpRefs.current[i] = el} type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)} autoFocus={i === 0} />
              ))}
            </div>
            {error && <p style={{ color: 'var(--loss)', fontSize: '0.8rem', textAlign: 'center', marginBottom: 10 }}>{error}</p>}
            {loading && <div className="spinner" />}
            <button className="btn btn-secondary btn-block" onClick={() => { setStep('phone'); setOtp(['','','','','','']); setError(''); }}>
              ← Change number
            </button>
          </>
        )}
      </div>
    </div>
  );
}
