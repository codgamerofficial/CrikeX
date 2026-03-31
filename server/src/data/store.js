import { v4 as uuid } from 'uuid';
import { MATCH_STATUS, MARKET_STATUS } from '../config/constants.js';

/* ──────────────────────── MOCK DATA STORE ──────────────────────── */

// Teams
const TEAMS = {
  CSK: { name: 'Chennai Super Kings', short: 'CSK', color: '#FFCB05' },
  MI:  { name: 'Mumbai Indians', short: 'MI', color: '#004BA0' },
  RCB: { name: 'Royal Challengers Bengaluru', short: 'RCB', color: '#D4213D' },
  KKR: { name: 'Kolkata Knight Riders', short: 'KKR', color: '#3A225D' },
  DC:  { name: 'Delhi Capitals', short: 'DC', color: '#004C93' },
  SRH: { name: 'Sunrisers Hyderabad', short: 'SRH', color: '#FF822A' },
  RR:  { name: 'Rajasthan Royals', short: 'RR', color: '#EA1A85' },
  PBKS:{ name: 'Punjab Kings', short: 'PBKS', color: '#DD1F2D' },
  GT:  { name: 'Gujarat Titans', short: 'GT', color: '#1B2133' },
  LSG: { name: 'Lucknow Super Giants', short: 'LSG', color: '#A72056' },
};

// Users
export const users = new Map();
export const otpStore = new Map();
export const kycRecords = new Map();
export const wallets = new Map();
export const transactions = new Map();
export const predictions = new Map();
export const leaderboardEntries = [];
export const sessionsMap = new Map();

// Helper to seed a user
function seedUser(id, data) {
  users.set(id, { id, ...data });
  wallets.set(id, { id: uuid(), userId: id, coinsBalance: data.coins || 10000, premiumBalance: 0, version: 0, updatedAt: new Date() });
  transactions.set(id, []);
}

// Seed demo users
seedUser('u1', { phone: '+919999900001', email: 'virat@demo.com', username: 'ViratFan18', avatarUrl: null, role: 'user', stateCode: 'IN-MH', isBlocked: false, kycStatus: 'verified', coins: 24500, createdAt: new Date('2026-01-15') });
seedUser('u2', { phone: '+919999900002', email: 'dhoni@demo.com', username: 'MSDhoni7', avatarUrl: null, role: 'premium', stateCode: 'IN-TN', isBlocked: false, kycStatus: 'verified', coins: 67800, createdAt: new Date('2026-01-10') });
seedUser('u3', { phone: '+919999900003', email: 'rohit@demo.com', username: 'HitmanRo45', avatarUrl: null, role: 'user', stateCode: 'IN-KA', isBlocked: false, kycStatus: 'pending', coins: 8200, createdAt: new Date('2026-02-20') });

// Matches
export const matches = [
  {
    id: 'm1', sport: 'cricket', league: 'IPL 2026', teamA: 'CSK', teamB: 'MI',
    venue: 'MA Chidambaram Stadium, Chennai', startTime: new Date(Date.now() + 3600000),
    status: MATCH_STATUS.UPCOMING, scoreData: {}, result: null,
    teamAData: TEAMS.CSK, teamBData: TEAMS.MI,
  },
  {
    id: 'm2', sport: 'cricket', league: 'IPL 2026', teamA: 'RCB', teamB: 'KKR',
    venue: 'M. Chinnaswamy Stadium, Bengaluru', startTime: new Date(Date.now() - 1800000),
    status: MATCH_STATUS.LIVE,
    scoreData: { teamA: { runs: 156, wickets: 4, overs: 16.3 }, teamB: { runs: 0, wickets: 0, overs: 0 }, batting: 'RCB', currentPartnership: '45(32)', lastWicket: 'AB de Villiers c Narine b Varun 34(22)' },
    result: null, teamAData: TEAMS.RCB, teamBData: TEAMS.KKR,
  },
  {
    id: 'm3', sport: 'cricket', league: 'IPL 2026', teamA: 'DC', teamB: 'SRH',
    venue: 'Arun Jaitley Stadium, Delhi', startTime: new Date(Date.now() + 86400000),
    status: MATCH_STATUS.UPCOMING, scoreData: {}, result: null,
    teamAData: TEAMS.DC, teamBData: TEAMS.SRH,
  },
  {
    id: 'm4', sport: 'cricket', league: 'IPL 2026', teamA: 'RR', teamB: 'GT',
    venue: 'Sawai Mansingh Stadium, Jaipur', startTime: new Date(Date.now() + 172800000),
    status: MATCH_STATUS.UPCOMING, scoreData: {}, result: null,
    teamAData: TEAMS.RR, teamBData: TEAMS.GT,
  },
  {
    id: 'm5', sport: 'cricket', league: 'IPL 2026', teamA: 'PBKS', teamB: 'LSG',
    venue: 'PCA Stadium, Mohali', startTime: new Date(Date.now() - 86400000),
    status: MATCH_STATUS.COMPLETED,
    scoreData: { teamA: { runs: 189, wickets: 6, overs: 20 }, teamB: { runs: 178, wickets: 10, overs: 19.4 } },
    result: 'team_a', teamAData: TEAMS.PBKS, teamBData: TEAMS.LSG,
  },
  {
    id: 'm6', sport: 'cricket', league: 'IPL 2026', teamA: 'MI', teamB: 'RCB',
    venue: 'Wankhede Stadium, Mumbai', startTime: new Date(Date.now() + 259200000),
    status: MATCH_STATUS.UPCOMING, scoreData: {}, result: null,
    teamAData: TEAMS.MI, teamBData: TEAMS.RCB,
  },
];

// Markets for each match
export const markets = [
  { id: 'mk1', matchId: 'm1', type: 'match_winner', description: 'Who will win?', options: [{ key: 'team_a', label: 'CSK', odds: 1.85 }, { key: 'team_b', label: 'MI', odds: 1.95 }], status: MARKET_STATUS.OPEN, result: null },
  { id: 'mk2', matchId: 'm1', type: 'top_scorer', description: 'Top scorer of the match?', options: [{ key: 'dhoni', label: 'MS Dhoni', odds: 5.5 }, { key: 'rohit', label: 'Rohit Sharma', odds: 4.2 }, { key: 'ruturaj', label: 'Ruturaj Gaikwad', odds: 3.8 }, { key: 'surya', label: 'Suryakumar Yadav', odds: 4.0 }], status: MARKET_STATUS.OPEN, result: null },
  { id: 'mk3', matchId: 'm1', type: 'total_runs', description: 'Total match runs over/under 340.5?', options: [{ key: 'over', label: 'Over 340.5', odds: 1.90 }, { key: 'under', label: 'Under 340.5', odds: 1.90 }], status: MARKET_STATUS.OPEN, result: null },
  { id: 'mk4', matchId: 'm2', type: 'match_winner', description: 'Who will win?', options: [{ key: 'team_a', label: 'RCB', odds: 1.55 }, { key: 'team_b', label: 'KKR', odds: 2.35 }], status: MARKET_STATUS.OPEN, result: null },
  { id: 'mk5', matchId: 'm2', type: 'total_sixes', description: 'Total sixes in the match?', options: [{ key: 'over', label: 'Over 12.5', odds: 1.75 }, { key: 'under', label: 'Under 12.5', odds: 2.05 }], status: MARKET_STATUS.OPEN, result: null },
  { id: 'mk6', matchId: 'm3', type: 'match_winner', description: 'Who will win?', options: [{ key: 'team_a', label: 'DC', odds: 2.10 }, { key: 'team_b', label: 'SRH', odds: 1.72 }], status: MARKET_STATUS.OPEN, result: null },
  { id: 'mk7', matchId: 'm4', type: 'match_winner', description: 'Who will win?', options: [{ key: 'team_a', label: 'RR', odds: 1.65 }, { key: 'team_b', label: 'GT', odds: 2.20 }], status: MARKET_STATUS.OPEN, result: null },
  { id: 'mk8', matchId: 'm5', type: 'match_winner', description: 'Who will win?', options: [{ key: 'team_a', label: 'PBKS', odds: 1.85 }, { key: 'team_b', label: 'LSG', odds: 1.95 }], status: MARKET_STATUS.SETTLED, result: 'team_a' },
  { id: 'mk9', matchId: 'm6', type: 'match_winner', description: 'Who will win?', options: [{ key: 'team_a', label: 'MI', odds: 1.70 }, { key: 'team_b', label: 'RCB', odds: 2.15 }], status: MARKET_STATUS.OPEN, result: null },
];

// Seed leaderboard
const leaderboardNames = ['ViratFan18', 'MSDhoni7', 'CricketGuru', 'IPLKing99', 'SixerQueen', 'BowlerBoss', 'RunChaser', 'WicketHunter', 'SpinMaster', 'PaceLord', 'BatFirst11', 'ChaseKing', 'AllRounder7', 'PowerPlay', 'DeathOvers'];
leaderboardNames.forEach((name, i) => {
  leaderboardEntries.push({
    id: uuid(), userId: i < 3 ? `u${i + 1}` : uuid(), username: name,
    period: 'season', periodKey: 'IPL-2026',
    points: Math.floor(15000 - i * 820 + Math.random() * 300),
    predictionsWon: Math.floor(80 - i * 4 + Math.random() * 10),
    streak: Math.max(0, Math.floor(12 - i + Math.random() * 3)),
    rank: i + 1,
  });
});
leaderboardEntries.sort((a, b) => b.points - a.points);
leaderboardEntries.forEach((e, i) => e.rank = i + 1);

export default { users, otpStore, kycRecords, wallets, transactions, predictions, matches, markets, leaderboardEntries, TEAMS };
