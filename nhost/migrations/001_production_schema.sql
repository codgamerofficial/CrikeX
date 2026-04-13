-- ═══════════════════════════════════════════════════════
-- CrikeX Production Database Schema
-- Nhost / PostgreSQL — ACID-compliant data backbone
-- ═══════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════ USERS ═══════
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appwrite_id VARCHAR(50) UNIQUE, -- Appwrite user ID
  phone VARCHAR(15) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'premium')),
  kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'submitted', 'verified', 'rejected')),
  state_code VARCHAR(10) DEFAULT 'IN-MH',
  is_blocked BOOLEAN DEFAULT FALSE,
  referral_code VARCHAR(10) UNIQUE,
  referred_by UUID REFERENCES users(id),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════ WALLETS ═══════
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coins_balance BIGINT DEFAULT 10000 CHECK (coins_balance >= 0),
  premium_balance BIGINT DEFAULT 0 CHECK (premium_balance >= 0),
  total_deposited BIGINT DEFAULT 0,
  total_withdrawn BIGINT DEFAULT 0,
  version INT DEFAULT 0, -- optimistic locking
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════ WALLET TRANSACTIONS (Append-only ledger) ═══════
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'deposit', 'withdraw', 'bet_stake', 'bet_payout',
    'bonus', 'referral', 'daily_bonus', 'signup_bonus',
    'razorpay_deposit', 'razorpay_refund'
  )),
  amount BIGINT NOT NULL, -- positive = credit, negative = debit
  balance_after BIGINT NOT NULL,
  ref_type VARCHAR(30), -- 'bet', 'match', 'razorpay', etc.
  ref_id VARCHAR(100),
  description TEXT,
  metadata JSONB DEFAULT '{}', -- razorpay payment details, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════ MATCHES (Persisted from Convex) ═══════
CREATE TABLE matches (
  id VARCHAR(50) PRIMARY KEY,
  sport VARCHAR(20) DEFAULT 'cricket',
  league VARCHAR(50),
  team_a JSONB NOT NULL, -- { name, short, color }
  team_b JSONB NOT NULL,
  venue VARCHAR(200),
  start_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
  score_data JSONB DEFAULT '{}',
  result VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════ BETS (Persisted from Convex) ═══════
CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_bet_id VARCHAR(100), -- Convex internal ID
  user_id UUID NOT NULL REFERENCES users(id),
  match_id VARCHAR(50) NOT NULL REFERENCES matches(id),
  market_id VARCHAR(50) NOT NULL,
  market_title VARCHAR(100),
  selection VARCHAR(50) NOT NULL,
  odds_at_placement DECIMAL(8,2) NOT NULL,
  coins_staked BIGINT NOT NULL CHECK (coins_staked > 0),
  potential_payout BIGINT NOT NULL,
  payout BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'voided')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════ KYC RECORDS ═══════
CREATE TABLE kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  pan_number VARCHAR(10),
  full_name VARCHAR(100),
  dob DATE,
  aadhaar_last4 VARCHAR(4),
  document_file_id VARCHAR(100), -- Appwrite Storage file ID
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════ RAZORPAY PAYMENTS ═══════
CREATE TABLE razorpay_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  razorpay_order_id VARCHAR(100) UNIQUE,
  razorpay_payment_id VARCHAR(100),
  razorpay_signature VARCHAR(200),
  amount BIGINT NOT NULL, -- in paisa
  currency VARCHAR(3) DEFAULT 'INR',
  status VARCHAR(20) DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  method VARCHAR(20), -- upi, card, netbanking
  upi_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════ LEADERBOARD ═══════
CREATE TABLE leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  username VARCHAR(50) NOT NULL,
  period VARCHAR(20) DEFAULT 'season',
  period_key VARCHAR(20) DEFAULT 'IPL-2026',
  points BIGINT DEFAULT 0,
  predictions_won INT DEFAULT 0,
  predictions_total INT DEFAULT 0,
  streak INT DEFAULT 0,
  rank INT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period, period_key)
);

-- ═══════ PERFORMANCE INDEXES ═══════
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_appwrite ON users(appwrite_id);
CREATE INDEX idx_users_referral ON users(referral_code);
CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_txn_user_date ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX idx_txn_type ON wallet_transactions(type);
CREATE INDEX idx_bets_user_date ON bets(user_id, created_at DESC);
CREATE INDEX idx_bets_match ON bets(match_id);
CREATE INDEX idx_bets_market ON bets(market_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_start ON matches(start_time);
CREATE INDEX idx_payments_user ON razorpay_payments(user_id);
CREATE INDEX idx_payments_order ON razorpay_payments(razorpay_order_id);
CREATE INDEX idx_leaderboard_rank ON leaderboard(period_key, rank);

-- ═══════ ATOMIC WALLET FUNCTIONS ═══════

-- Place bet: deduct stake atomically
CREATE OR REPLACE FUNCTION place_bet(
  p_user_id UUID,
  p_match_id VARCHAR,
  p_market_id VARCHAR,
  p_market_title VARCHAR,
  p_selection VARCHAR,
  p_odds DECIMAL,
  p_stake BIGINT,
  p_convex_bet_id VARCHAR DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_bet_id UUID;
  v_payout BIGINT;
BEGIN
  -- Lock wallet row to prevent concurrent modification
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;
  
  IF v_wallet.coins_balance < p_stake THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: have %, need %', v_wallet.coins_balance, p_stake;
  END IF;
  
  v_payout := FLOOR(p_stake * p_odds);
  
  -- Deduct stake
  UPDATE wallets SET
    coins_balance = coins_balance - p_stake,
    version = version + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Create bet record
  INSERT INTO bets (user_id, match_id, market_id, market_title, selection, odds_at_placement, coins_staked, potential_payout, convex_bet_id)
  VALUES (p_user_id, p_match_id, p_market_id, p_market_title, p_selection, p_odds, p_stake, v_payout, p_convex_bet_id)
  RETURNING id INTO v_bet_id;
  
  -- Log transaction
  INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, ref_type, ref_id, description)
  VALUES (v_wallet.id, p_user_id, 'bet_stake', -p_stake, v_wallet.coins_balance - p_stake, 'bet', v_bet_id::TEXT,
    FORMAT('Bet on %s: %s @ %sx', p_market_title, p_selection, p_odds));
  
  RETURN v_bet_id;
END;
$$;

-- Settle bet: credit payout atomically
CREATE OR REPLACE FUNCTION settle_bet(p_bet_id UUID, p_won BOOLEAN) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_bet bets%ROWTYPE;
  v_wallet wallets%ROWTYPE;
BEGIN
  -- Lock bet row
  SELECT * INTO v_bet FROM bets WHERE id = p_bet_id AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  
  IF p_won THEN
    -- Lock wallet and credit payout
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_bet.user_id FOR UPDATE;
    
    UPDATE wallets SET
      coins_balance = coins_balance + v_bet.potential_payout,
      version = version + 1,
      updated_at = NOW()
    WHERE user_id = v_bet.user_id;
    
    UPDATE bets SET status = 'won', payout = v_bet.potential_payout, settled_at = NOW() WHERE id = p_bet_id;
    
    INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, ref_type, ref_id, description)
    VALUES (v_wallet.id, v_bet.user_id, 'bet_payout', v_bet.potential_payout,
      v_wallet.coins_balance + v_bet.potential_payout, 'bet', p_bet_id::TEXT, 'Bet won! 🎉');
  ELSE
    UPDATE bets SET status = 'lost', settled_at = NOW() WHERE id = p_bet_id;
  END IF;
END;
$$;

-- Claim daily bonus
CREATE OR REPLACE FUNCTION claim_daily_bonus(p_user_id UUID, p_amount BIGINT DEFAULT 500) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_last_claim TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  
  -- Check if already claimed today
  SELECT created_at INTO v_last_claim FROM wallet_transactions
  WHERE user_id = p_user_id AND type = 'daily_bonus'
  ORDER BY created_at DESC LIMIT 1;
  
  IF v_last_claim IS NOT NULL AND v_last_claim::DATE = CURRENT_DATE THEN
    RAISE EXCEPTION 'ALREADY_CLAIMED_TODAY';
  END IF;
  
  -- Credit bonus
  UPDATE wallets SET coins_balance = coins_balance + p_amount, version = version + 1, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, ref_type, description)
  VALUES (v_wallet.id, p_user_id, 'daily_bonus', p_amount, v_wallet.coins_balance + p_amount, 'system', FORMAT('Daily bonus: +%s coins 🎁', p_amount));
  
  RETURN FORMAT('Claimed %s bonus coins!', p_amount);
END;
$$;

-- Initialize wallet for new user
CREATE OR REPLACE FUNCTION init_wallet(p_user_id UUID, p_starting_coins BIGINT DEFAULT 10000) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  INSERT INTO wallets (user_id, coins_balance)
  VALUES (p_user_id, p_starting_coins)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_wallet_id;
  
  IF v_wallet_id IS NOT NULL THEN
    INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance_after, ref_type, description)
    VALUES (v_wallet_id, p_user_id, 'signup_bonus', p_starting_coins, p_starting_coins, 'system', 'Welcome to CrikeX! 🏏');
  END IF;
  
  RETURN v_wallet_id;
END;
$$;
