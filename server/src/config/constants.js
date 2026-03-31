import 'dotenv/config';

export const RESTRICTED_STATES = ['IN-AP', 'IN-TG', 'IN-AS', 'IN-SK', 'IN-NL'];

export const SPORTS = ['cricket', 'football', 'kabaddi', 'tennis'];

export const PREDICTION_LIMITS = {
  MAX_PER_HOUR: 50,
  MAX_PER_DAY: 100,
  MAX_PER_MATCH: 5,
  MIN_COINS: 10,
  MAX_COINS: 5000,
  COOLDOWN_THRESHOLD: 20,
  COOLDOWN_MINUTES: 5,
};

export const WALLET = {
  STARTING_COINS: 10000,
  DAILY_LOGIN_BONUS: 500,
  STREAK_MULTIPLIER: 1.2,
  MAX_DAILY_BONUS: 2500,
  REFERRAL_BONUS: 1000,
};

export const KYC_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

export const MATCH_STATUS = {
  UPCOMING: 'upcoming',
  LIVE: 'live',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const MARKET_STATUS = {
  OPEN: 'open',
  SUSPENDED: 'suspended',
  CLOSED: 'closed',
  SETTLED: 'settled',
};

export const JWT_SECRET = process.env.JWT_SECRET || 'crikex-dev-secret-change-in-prod';
export const JWT_EXPIRY = '7d';
export const PORT = process.env.PORT || 3001;
