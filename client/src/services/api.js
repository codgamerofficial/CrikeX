const BASE = '/api/v1';

async function request(path, options = {}) {
  const token = localStorage.getItem('crikex_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const api = {
  // Auth
  sendOtp: (phone) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (otpRef, otp, stateCode) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ otpRef, otp, stateCode }) }),
  // Matches
  getMatches: (params = '') => request(`/matches${params ? '?' + params : ''}`),
  getMatch: (id) => request(`/matches/${id}`),
  // Predictions
  placePrediction: (data) => request('/predictions', { method: 'POST', body: JSON.stringify(data) }),
  getMyPredictions: (params = '') => request(`/predictions/my${params ? '?' + params : ''}`),
  // Wallet
  getWallet: () => request('/wallet'),
  getTransactions: (page = 1) => request(`/wallet/transactions?page=${page}`),
  claimDaily: () => request('/wallet/claim-daily', { method: 'POST' }),
  // Leaderboard
  getLeaderboard: (params = '') => request(`/leaderboard${params ? '?' + params : ''}`),
  // User
  getMe: () => request('/users/me'),
  updateMe: (data) => request('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  submitKyc: (data) => request('/users/kyc', { method: 'POST', body: JSON.stringify(data) }),
  getKycStatus: () => request('/users/kyc/status'),
  // Referrals
  getMyReferral: () => request('/referrals/my'),
  applyReferral: (code) => request('/referrals/apply', { method: 'POST', body: JSON.stringify({ referralCode: code }) }),
  // Admin
  adminDashboard: () => request('/admin/dashboard'),
  adminUsers: (params = '') => request(`/admin/users${params ? '?' + params : ''}`),
  adminMatches: () => request('/admin/matches'),
  adminBlockUser: (id, reason) => request(`/admin/users/${id}/block`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  adminMatchStatus: (id, status) => request(`/admin/matches/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adminSettleMarket: (id, result) => request(`/admin/markets/${id}/settle`, { method: 'POST', body: JSON.stringify({ result }) }),
};

export default api;
