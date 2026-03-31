-- ═══════════════════════════════════════════════════════════════
-- CrikeX — PostgreSQL Production Schema
-- Version: 1.0.0  |  Engine: PostgreSQL 16
-- ═══════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════ USERS ═══════════
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone           VARCHAR(15) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE,
    username        VARCHAR(50) UNIQUE NOT NULL,
    password_hash   TEXT,
    avatar_url      TEXT,
    role            VARCHAR(20) DEFAULT 'user'
                    CHECK (role IN ('user','premium','moderator','admin')),
    state_code      VARCHAR(5) NOT NULL,
    is_blocked      BOOLEAN DEFAULT FALSE,
    block_reason    TEXT,
    kyc_status      VARCHAR(20) DEFAULT 'pending'
                    CHECK (kyc_status IN ('pending','submitted','verified','rejected')),
    referral_code   VARCHAR(12) UNIQUE NOT NULL,
    referred_by     UUID REFERENCES users(id),
    risk_score      DECIMAL(5,2) DEFAULT 0.00,
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    login_count     INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_state ON users(state_code);
CREATE INDEX idx_users_referral ON users(referral_code);
CREATE INDEX idx_users_referred_by ON users(referred_by);
CREATE INDEX idx_users_risk ON users(risk_score DESC);

-- ═══════════ KYC RECORDS ═══════════
CREATE TABLE kyc_records (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pan_number_hash   TEXT NOT NULL,  -- bcrypt hashed
    pan_last4         VARCHAR(4),
    aadhaar_hash      TEXT,           -- SHA-256 hash only
    aadhaar_last4     VARCHAR(4),
    full_name         TEXT NOT NULL,
    dob               DATE NOT NULL,
    address_line      TEXT,
    address_state     VARCHAR(5),
    address_pincode   VARCHAR(6),
    document_urls     JSONB DEFAULT '{}',
    selfie_url        TEXT,
    verification_mode VARCHAR(20) DEFAULT 'manual'
                      CHECK (verification_mode IN ('manual','digilocker','ekyc','auto')),
    status            VARCHAR(20) DEFAULT 'pending'
                      CHECK (status IN ('pending','submitted','in_review','verified','rejected')),
    reviewer_id       UUID REFERENCES users(id),
    reviewed_at       TIMESTAMPTZ,
    rejection_reason  TEXT,
    attempts          INTEGER DEFAULT 0,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_kyc_status ON kyc_records(status);

-- ═══════════ USER SESSIONS ═══════════
CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL,
    device_id       VARCHAR(255),
    device_type     VARCHAR(50),
    ip_address      INET,
    user_agent      TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id, is_active);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);

-- ═══════════ OTP STORE ═══════════
CREATE TABLE otp_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone           VARCHAR(15) NOT NULL,
    otp_hash        TEXT NOT NULL,
    otp_ref         VARCHAR(12) UNIQUE NOT NULL,
    purpose         VARCHAR(20) DEFAULT 'login'
                    CHECK (purpose IN ('login','kyc','withdraw','reset')),
    attempts        INTEGER DEFAULT 0,
    max_attempts    INTEGER DEFAULT 3,
    is_used         BOOLEAN DEFAULT FALSE,
    ip_address      INET,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_otp_ref ON otp_records(otp_ref);
CREATE INDEX idx_otp_phone ON otp_records(phone, created_at DESC);

-- ═══════════ MATCHES ═══════════
CREATE TABLE matches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id     VARCHAR(100) UNIQUE,  -- from data provider
    sport           VARCHAR(30) NOT NULL DEFAULT 'cricket',
    league          VARCHAR(100) NOT NULL,
    season          VARCHAR(20),
    team_a_code     VARCHAR(10) NOT NULL,
    team_a_name     VARCHAR(100) NOT NULL,
    team_a_logo     TEXT,
    team_b_code     VARCHAR(10) NOT NULL,
    team_b_name     VARCHAR(100) NOT NULL,
    team_b_logo     TEXT,
    venue           TEXT,
    city            VARCHAR(100),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming','live','completed','cancelled','postponed')),
    score_data      JSONB DEFAULT '{}',
    toss_winner     VARCHAR(10),
    toss_decision   VARCHAR(10),
    result          VARCHAR(20),
    result_text     TEXT,
    man_of_match    TEXT,
    is_featured     BOOLEAN DEFAULT FALSE,
    prediction_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_start ON matches(start_time);
CREATE INDEX idx_matches_league ON matches(league, season);
CREATE INDEX idx_matches_featured ON matches(is_featured) WHERE is_featured = TRUE;

-- ═══════════ MARKETS ═══════════
CREATE TABLE markets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id        UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    category        VARCHAR(30) DEFAULT 'pre_match'
                    CHECK (category IN ('pre_match','in_play','specials')),
    description     TEXT NOT NULL,
    options         JSONB NOT NULL,
    status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open','suspended','closed','settled','voided')),
    result          VARCHAR(100),
    settlement_data JSONB,
    margin          DECIMAL(5,4) DEFAULT 0.0500,
    max_stake       INTEGER DEFAULT 5000,
    total_pool      BIGINT DEFAULT 0,
    settled_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_markets_match ON markets(match_id, status);
CREATE INDEX idx_markets_type ON markets(type);

-- ═══════════ WALLETS ═══════════
CREATE TABLE wallets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coins_balance   BIGINT DEFAULT 10000 CHECK (coins_balance >= 0),
    bonus_balance   BIGINT DEFAULT 0 CHECK (bonus_balance >= 0),
    winnings_bal    BIGINT DEFAULT 0 CHECK (winnings_bal >= 0),
    total_deposited BIGINT DEFAULT 0,
    total_withdrawn BIGINT DEFAULT 0,
    total_wagered   BIGINT DEFAULT 0,
    total_won       BIGINT DEFAULT 0,
    version         INTEGER DEFAULT 0,  -- optimistic concurrency control
    is_locked       BOOLEAN DEFAULT FALSE,
    lock_reason     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- ═══════════ TRANSACTIONS ═══════════
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id       UUID NOT NULL REFERENCES wallets(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            VARCHAR(30) NOT NULL
                    CHECK (type IN ('credit','debit','bonus','refund',
                           'daily_login','achievement','referral',
                           'deposit','withdrawal','winnings','commission')),
    amount          BIGINT NOT NULL CHECK (amount > 0),
    balance_before  BIGINT NOT NULL,
    balance_after   BIGINT NOT NULL,
    ref_type        VARCHAR(30),
    ref_id          UUID,
    description     TEXT,
    metadata        JSONB DEFAULT '{}',
    status          VARCHAR(20) DEFAULT 'completed'
                    CHECK (status IN ('pending','processing','completed','failed','reversed')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tx_wallet ON transactions(wallet_id, created_at DESC);
CREATE INDEX idx_tx_user ON transactions(user_id, created_at DESC);
CREATE INDEX idx_tx_type ON transactions(type);
CREATE INDEX idx_tx_ref ON transactions(ref_type, ref_id);

-- ═══════════ PREDICTIONS / BETS ═══════════
CREATE TABLE predictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    match_id        UUID NOT NULL REFERENCES matches(id),
    market_id       UUID NOT NULL REFERENCES markets(id),
    selection       VARCHAR(100) NOT NULL,
    selection_label VARCHAR(200),
    coins_staked    INTEGER NOT NULL CHECK (coins_staked > 0),
    odds_at_place   DECIMAL(8,4) NOT NULL CHECK (odds_at_place > 1.0),
    potential_payout INTEGER NOT NULL,
    status          VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active','won','lost','void','cashed_out','settled')),
    payout_coins    INTEGER DEFAULT 0,
    settled_at      TIMESTAMPTZ,
    settlement_ref  UUID,
    ip_address      INET,
    device_id       VARCHAR(255),
    risk_flag       VARCHAR(20) DEFAULT 'normal'
                    CHECK (risk_flag IN ('normal','review','suspicious','blocked')),
    placed_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pred_user ON predictions(user_id, placed_at DESC);
CREATE INDEX idx_pred_match ON predictions(match_id);
CREATE INDEX idx_pred_market ON predictions(market_id, status);
CREATE INDEX idx_pred_status ON predictions(status);
CREATE INDEX idx_pred_risk ON predictions(risk_flag) WHERE risk_flag != 'normal';

-- ═══════════ LEADERBOARD ═══════════
CREATE TABLE leaderboard_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    period          VARCHAR(20) NOT NULL,
    period_key      VARCHAR(30) NOT NULL,
    points          INTEGER DEFAULT 0,
    rank            INTEGER,
    predictions_total INTEGER DEFAULT 0,
    predictions_won INTEGER DEFAULT 0,
    predictions_lost INTEGER DEFAULT 0,
    win_rate        DECIMAL(5,2) DEFAULT 0.00,
    streak          INTEGER DEFAULT 0,
    best_streak     INTEGER DEFAULT 0,
    roi             DECIMAL(8,2) DEFAULT 0.00,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, period, period_key)
);

CREATE INDEX idx_lb_period ON leaderboard_entries(period, period_key, points DESC);

-- ═══════════ REFERRALS ═══════════
CREATE TABLE referrals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id     UUID NOT NULL REFERENCES users(id),
    referred_id     UUID NOT NULL REFERENCES users(id),
    referral_code   VARCHAR(12) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','activated','rewarded','expired')),
    referrer_bonus  INTEGER DEFAULT 0,
    referred_bonus  INTEGER DEFAULT 0,
    activated_at    TIMESTAMPTZ,
    rewarded_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(referred_id)
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- ═══════════ FRAUD / AUDIT LOGS ═══════════
CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(50) NOT NULL,
    resource_type   VARCHAR(50),
    resource_id     UUID,
    details         JSONB DEFAULT '{}',
    ip_address      INET,
    user_agent      TEXT,
    risk_score      DECIMAL(5,2) DEFAULT 0.00,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_risk ON audit_logs(risk_score DESC) WHERE risk_score > 0.5;

-- ═══════════ FRAUD ALERTS ═══════════
CREATE TABLE fraud_alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    alert_type      VARCHAR(50) NOT NULL,
    severity        VARCHAR(20) DEFAULT 'low'
                    CHECK (severity IN ('low','medium','high','critical')),
    description     TEXT NOT NULL,
    evidence        JSONB DEFAULT '{}',
    status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open','investigating','resolved','false_positive','escalated')),
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fraud_user ON fraud_alerts(user_id);
CREATE INDEX idx_fraud_severity ON fraud_alerts(severity, status);

-- ═══════════ RESPONSIBLE GAMING ═══════════
CREATE TABLE responsible_gaming (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID UNIQUE NOT NULL REFERENCES users(id),
    daily_limit     INTEGER DEFAULT 100,       -- max predictions/day
    weekly_limit    INTEGER DEFAULT 500,
    monthly_limit   INTEGER DEFAULT 2000,
    session_limit_mins INTEGER DEFAULT 180,     -- max session duration
    cooldown_active BOOLEAN DEFAULT FALSE,
    cooldown_until  TIMESTAMPTZ,
    self_excluded   BOOLEAN DEFAULT FALSE,
    self_excluded_until TIMESTAMPTZ,
    exclusion_type  VARCHAR(20),
    reality_check_interval INTEGER DEFAULT 60,  -- minutes
    last_reality_check TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════ GEO RESTRICTIONS ═══════════
CREATE TABLE geo_restrictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_code      VARCHAR(5) UNIQUE NOT NULL,
    state_name      VARCHAR(100) NOT NULL,
    is_restricted   BOOLEAN DEFAULT FALSE,
    restriction_type VARCHAR(30) DEFAULT 'full'
                    CHECK (restriction_type IN ('full','partial','age_restricted','none')),
    legal_basis     TEXT,
    effective_from  DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed geo restrictions
INSERT INTO geo_restrictions (state_code, state_name, is_restricted, restriction_type, legal_basis) VALUES
('IN-AP', 'Andhra Pradesh', TRUE, 'full', 'AP Gaming Act + PROGA 2025'),
('IN-TG', 'Telangana', TRUE, 'full', 'Telangana Gaming Act 2017 + PROGA 2025'),
('IN-AS', 'Assam', TRUE, 'full', 'Assam Game & Betting Act + PROGA 2025'),
('IN-SK', 'Sikkim', TRUE, 'partial', 'Sikkim Online Gaming Act 2008'),
('IN-NL', 'Nagaland', TRUE, 'partial', 'Nagaland Prohibition of Gambling Act'),
('IN-MH', 'Maharashtra', FALSE, 'none', NULL),
('IN-KA', 'Karnataka', FALSE, 'none', NULL),
('IN-TN', 'Tamil Nadu', FALSE, 'none', NULL),
('IN-DL', 'Delhi', FALSE, 'none', NULL),
('IN-RJ', 'Rajasthan', FALSE, 'none', NULL),
('IN-GJ', 'Gujarat', FALSE, 'none', NULL),
('IN-WB', 'West Bengal', FALSE, 'none', NULL),
('IN-UP', 'Uttar Pradesh', FALSE, 'none', NULL),
('IN-KL', 'Kerala', FALSE, 'none', NULL),
('IN-PB', 'Punjab', FALSE, 'none', NULL);

-- ═══════════ ADMIN SETTINGS ═══════════
CREATE TABLE admin_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_settings (key, value, description) VALUES
('platform_status', '"active"', 'Platform operational status'),
('maintenance_mode', 'false', 'Whether platform is in maintenance'),
('min_prediction_coins', '10', 'Minimum coins per prediction'),
('max_prediction_coins', '5000', 'Maximum coins per prediction'),
('daily_login_bonus', '500', 'Daily login bonus coins'),
('referral_bonus_referrer', '1000', 'Referral bonus for referrer'),
('referral_bonus_referred', '500', 'Referral bonus for new user'),
('signup_bonus', '10000', 'Initial signup coins'),
('max_predictions_per_match', '5', 'Max predictions per match per user'),
('odds_update_interval_ms', '8000', 'Live odds update interval');

-- ═══════════ NOTIFICATIONS ═══════════
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    type            VARCHAR(30) NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT,
    data            JSONB DEFAULT '{}',
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);

-- ═══════════ FUNCTIONS ═══════════

-- Function: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_matches_updated BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_markets_updated BEFORE UPDATE ON markets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON kyc_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function: Atomic wallet debit with optimistic locking
CREATE OR REPLACE FUNCTION debit_wallet(
    p_user_id UUID,
    p_amount BIGINT,
    p_expected_version INTEGER
) RETURNS TABLE(success BOOLEAN, new_balance BIGINT, new_version INTEGER) AS $$
DECLARE
    v_balance BIGINT;
    v_version INTEGER;
BEGIN
    UPDATE wallets
    SET coins_balance = coins_balance - p_amount,
        total_wagered = total_wagered + p_amount,
        version = version + 1
    WHERE user_id = p_user_id
      AND version = p_expected_version
      AND coins_balance >= p_amount
      AND is_locked = FALSE
    RETURNING coins_balance, version INTO v_balance, v_version;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::BIGINT, 0;
    ELSE
        RETURN QUERY SELECT TRUE, v_balance, v_version;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Credit wallet (winnings)
CREATE OR REPLACE FUNCTION credit_wallet(
    p_user_id UUID,
    p_amount BIGINT
) RETURNS TABLE(success BOOLEAN, new_balance BIGINT) AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    UPDATE wallets
    SET coins_balance = coins_balance + p_amount,
        total_won = total_won + p_amount,
        version = version + 1
    WHERE user_id = p_user_id AND is_locked = FALSE
    RETURNING coins_balance INTO v_balance;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::BIGINT;
    ELSE
        RETURN QUERY SELECT TRUE, v_balance;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ═══════════ VIEWS ═══════════

-- User stats view for admin
CREATE OR REPLACE VIEW v_user_stats AS
SELECT
    u.id, u.username, u.phone, u.state_code, u.role, u.kyc_status, u.risk_score,
    w.coins_balance, w.total_wagered, w.total_won,
    COUNT(DISTINCT p.id) AS total_predictions,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'won') AS won_predictions,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'lost') AS lost_predictions,
    u.created_at, u.last_login_at
FROM users u
LEFT JOIN wallets w ON w.user_id = u.id
LEFT JOIN predictions p ON p.user_id = u.id
GROUP BY u.id, w.coins_balance, w.total_wagered, w.total_won;

-- Daily platform metrics
CREATE OR REPLACE VIEW v_daily_metrics AS
SELECT
    DATE(created_at) AS date,
    COUNT(*) AS total_predictions,
    SUM(coins_staked) AS total_staked,
    COUNT(DISTINCT user_id) AS unique_users,
    AVG(odds_at_place) AS avg_odds,
    COUNT(*) FILTER (WHERE status = 'won') AS won,
    COUNT(*) FILTER (WHERE status = 'lost') AS lost
FROM predictions
GROUP BY DATE(created_at)
ORDER BY date DESC;
