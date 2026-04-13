/**
 * Nhost Client — PostgreSQL + GraphQL data layer
 * Handles: Wallet, Bets, Transactions, Leaderboard
 */
import { NhostClient } from '@nhost/nhost-js';
import { GraphQLClient, gql } from 'graphql-request';

// ── Nhost SDK initialization ──
const nhost = new NhostClient({
  subdomain: process.env.NHOST_SUBDOMAIN,
  region: process.env.NHOST_REGION || 'ap-south-1',
  adminSecret: process.env.NHOST_ADMIN_SECRET,
});

// ── Direct GraphQL client with admin secret ──
const graphql = new GraphQLClient(
  `https://${process.env.NHOST_SUBDOMAIN}.hasura.${process.env.NHOST_REGION || 'ap-south-1'}.nhost.run/v1/graphql`,
  {
    headers: {
      'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET,
    },
  }
);

// ═══════ USER OPERATIONS ═══════

/** Create or sync user from Appwrite to Nhost */
export async function syncUser(userData) {
  const mutation = gql`
    mutation UpsertUser(
      $id: uuid!, $phone: String!, $username: String!,
      $role: String, $kyc_status: String, $state_code: String,
      $appwrite_id: String, $referral_code: String
    ) {
      insert_users_one(
        object: {
          id: $id, phone: $phone, username: $username,
          role: $role, kyc_status: $kyc_status, state_code: $state_code,
          appwrite_id: $appwrite_id, referral_code: $referral_code
        }
        on_conflict: {
          constraint: users_phone_key,
          update_columns: [username, role, kyc_status, state_code, updated_at]
        }
      ) {
        id phone username role kyc_status
      }
    }
  `;
  return await graphql.request(mutation, userData);
}

// ═══════ WALLET OPERATIONS ═══════

/** Get wallet balance */
export async function getWallet(userId) {
  const query = gql`
    query GetWallet($userId: uuid!) {
      wallets(where: { user_id: { _eq: $userId } }) {
        id user_id coins_balance premium_balance version updated_at
      }
    }
  `;
  const data = await graphql.request(query, { userId });
  return data.wallets[0] || null;
}

/** Initialize wallet for new user (calls Postgres function) */
export async function initWallet(userId, startingCoins = 10000) {
  const mutation = gql`
    mutation InitWallet($userId: uuid!, $startingCoins: bigint!) {
      init_wallet(args: { p_user_id: $userId, p_starting_coins: $startingCoins })
    }
  `;
  try {
    return await graphql.request(mutation, { userId, startingCoins });
  } catch (err) {
    // Wallet may already exist (ON CONFLICT DO NOTHING)
    console.log('[Nhost] Wallet init:', err.message?.includes('null') ? 'already exists' : err.message);
    return null;
  }
}

/** Place bet atomically (calls Postgres function) */
export async function placeBet(params) {
  const mutation = gql`
    mutation PlaceBet(
      $userId: uuid!, $matchId: String!, $marketId: String!,
      $marketTitle: String!, $selection: String!, $odds: numeric!,
      $stake: bigint!, $convexBetId: String
    ) {
      place_bet(args: {
        p_user_id: $userId, p_match_id: $matchId, p_market_id: $marketId,
        p_market_title: $marketTitle, p_selection: $selection, p_odds: $odds,
        p_stake: $stake, p_convex_bet_id: $convexBetId
      })
    }
  `;
  return await graphql.request(mutation, {
    userId: params.userId,
    matchId: params.matchId,
    marketId: params.marketId,
    marketTitle: params.marketTitle || 'Bet',
    selection: params.selection,
    odds: params.odds,
    stake: params.stake,
    convexBetId: params.convexBetId || null,
  });
}

/** Settle bet (calls Postgres function) */
export async function settleBet(betId, won) {
  const mutation = gql`
    mutation SettleBet($betId: uuid!, $won: Boolean!) {
      settle_bet(args: { p_bet_id: $betId, p_won: $won })
    }
  `;
  return await graphql.request(mutation, { betId, won });
}

/** Claim daily bonus (calls Postgres function) */
export async function claimDailyBonus(userId, amount = 500) {
  const mutation = gql`
    mutation ClaimDaily($userId: uuid!, $amount: bigint!) {
      claim_daily_bonus(args: { p_user_id: $userId, p_amount: $amount })
    }
  `;
  return await graphql.request(mutation, { userId, amount });
}

/** Get transaction history */
export async function getTransactions(userId, limit = 20, offset = 0) {
  const query = gql`
    query GetTransactions($userId: uuid!, $limit: Int!, $offset: Int!) {
      wallet_transactions(
        where: { user_id: { _eq: $userId } }
        order_by: { created_at: desc }
        limit: $limit
        offset: $offset
      ) {
        id type amount balance_after ref_type ref_id description created_at metadata
      }
      wallet_transactions_aggregate(where: { user_id: { _eq: $userId } }) {
        aggregate { count }
      }
    }
  `;
  return await graphql.request(query, { userId, limit, offset });
}

// ═══════ BET QUERIES ═══════

/** Get user's bet history */
export async function getUserBets(userId, status = null, limit = 20) {
  const where = { user_id: { _eq: userId } };
  if (status) where.status = { _eq: status };

  const query = gql`
    query GetUserBets($where: bets_bool_exp!, $limit: Int!) {
      bets(where: $where, order_by: { created_at: desc }, limit: $limit) {
        id match_id market_id market_title selection odds_at_placement
        coins_staked potential_payout payout status settled_at created_at
      }
      bets_aggregate(where: $where) {
        aggregate {
          count
          sum { coins_staked payout }
        }
      }
    }
  `;
  return await graphql.request(query, { where, limit });
}

/** Get match bets summary (admin) */
export async function getMatchBets(matchId) {
  const query = gql`
    query MatchBets($matchId: String!) {
      bets(where: { match_id: { _eq: $matchId } }) {
        id user_id selection odds_at_placement coins_staked status
      }
      bets_aggregate(where: { match_id: { _eq: $matchId } }) {
        aggregate { count sum { coins_staked } }
      }
    }
  `;
  return await graphql.request(query, { matchId });
}

// ═══════ LEADERBOARD ═══════

/** Get leaderboard rankings */
export async function getLeaderboard(periodKey = 'IPL-2026', limit = 50) {
  const query = gql`
    query GetLeaderboard($periodKey: String!, $limit: Int!) {
      leaderboard(
        where: { period_key: { _eq: $periodKey } }
        order_by: { points: desc }
        limit: $limit
      ) {
        id user_id username points predictions_won predictions_total streak rank
      }
    }
  `;
  return await graphql.request(query, { periodKey, limit });
}

/** Update leaderboard entry */
export async function updateLeaderboard(userId, username, pointsDelta, won) {
  const mutation = gql`
    mutation UpsertLeaderboard(
      $userId: uuid!, $username: String!, $points: bigint!,
      $won: Int!, $total: Int!
    ) {
      insert_leaderboard_one(
        object: {
          user_id: $userId, username: $username, period: "season",
          period_key: "IPL-2026", points: $points,
          predictions_won: $won, predictions_total: $total
        }
        on_conflict: {
          constraint: leaderboard_user_id_period_period_key_key,
          update_columns: [points, predictions_won, predictions_total, updated_at]
        }
      ) {
        id points
      }
    }
  `;
  return await graphql.request(mutation, {
    userId, username, points: pointsDelta, won: won ? 1 : 0, total: 1,
  });
}

// ═══════ RAZORPAY PAYMENTS ═══════

/** Create payment record */
export async function createPaymentRecord(userId, orderId, amount) {
  const mutation = gql`
    mutation CreatePayment($userId: uuid!, $orderId: String!, $amount: bigint!) {
      insert_razorpay_payments_one(object: {
        user_id: $userId, razorpay_order_id: $orderId, amount: $amount
      }) {
        id razorpay_order_id
      }
    }
  `;
  return await graphql.request(mutation, { userId, orderId, amount });
}

/** Update payment status after Razorpay webhook */
export async function updatePaymentStatus(orderId, paymentId, signature, status, method, upiId) {
  const mutation = gql`
    mutation UpdatePayment(
      $orderId: String!, $paymentId: String!, $signature: String!,
      $status: String!, $method: String, $upiId: String
    ) {
      update_razorpay_payments(
        where: { razorpay_order_id: { _eq: $orderId } }
        _set: {
          razorpay_payment_id: $paymentId, razorpay_signature: $signature,
          status: $status, method: $method, upi_id: $upiId, updated_at: "now()"
        }
      ) {
        returning { id user_id amount status }
      }
    }
  `;
  return await graphql.request(mutation, { orderId, paymentId, signature, status, method, upiId });
}

/** Credit wallet after successful deposit */
export async function creditDeposit(userId, amount, orderId) {
  const wallet = await getWallet(userId);
  if (!wallet) throw new Error('WALLET_NOT_FOUND');

  const mutation = gql`
    mutation CreditDeposit($userId: uuid!, $amount: bigint!) {
      update_wallets(
        where: { user_id: { _eq: $userId } }
        _set: { updated_at: "now()" }
        _inc: { coins_balance: $amount, total_deposited: $amount, version: 1 }
      ) {
        returning { coins_balance }
      }
    }
  `;
  const result = await graphql.request(mutation, { userId, amount });

  // Log transaction
  const txMutation = gql`
    mutation LogDeposit($walletId: uuid!, $userId: uuid!, $amount: bigint!, $balanceAfter: bigint!, $orderId: String!) {
      insert_wallet_transactions_one(object: {
        wallet_id: $walletId, user_id: $userId, type: "razorpay_deposit",
        amount: $amount, balance_after: $balanceAfter,
        ref_type: "razorpay", ref_id: $orderId,
        description: "Deposit via Razorpay"
      }) { id }
    }
  `;
  const newBalance = result.update_wallets.returning[0].coins_balance;
  await graphql.request(txMutation, {
    walletId: wallet.id, userId, amount, balanceAfter: newBalance, orderId,
  });

  return { newBalance };
}

export default {
  syncUser, getWallet, initWallet,
  placeBet, settleBet, claimDailyBonus,
  getTransactions, getUserBets, getMatchBets,
  getLeaderboard, updateLeaderboard,
  createPaymentRecord, updatePaymentStatus, creditDeposit,
};
