// ═══════════════════════════════════════════════════════════════
// CrikeX — AI Odds Engine
// Bayesian probability model with multi-factor analysis
// ═══════════════════════════════════════════════════════════════

import logger from '../utils/logger.js';
import redis from './redis.js';

// Historical IPL data (simplified for demo)
const TEAM_RATINGS = {
  CSK: { elo: 1650, homeAdv: 1.08, recentForm: [1, 1, 0, 1, 1] },
  MI:  { elo: 1620, homeAdv: 1.10, recentForm: [1, 0, 1, 0, 1] },
  RCB: { elo: 1590, homeAdv: 1.05, recentForm: [0, 1, 1, 1, 0] },
  KKR: { elo: 1580, homeAdv: 1.06, recentForm: [1, 1, 0, 0, 1] },
  DC:  { elo: 1560, homeAdv: 1.04, recentForm: [0, 0, 1, 1, 0] },
  SRH: { elo: 1570, homeAdv: 1.07, recentForm: [1, 0, 0, 1, 1] },
  RR:  { elo: 1600, homeAdv: 1.06, recentForm: [1, 1, 1, 0, 0] },
  PBKS:{ elo: 1540, homeAdv: 1.03, recentForm: [0, 1, 0, 0, 1] },
  GT:  { elo: 1610, homeAdv: 1.05, recentForm: [1, 0, 1, 1, 1] },
  LSG: { elo: 1550, homeAdv: 1.04, recentForm: [0, 0, 1, 0, 0] },
};

const VENUE_FACTORS = {
  'Chennai': { pace_bias: 0.3, spin_bias: 0.7, avg_first_innings: 165, chase_win_pct: 0.45 },
  'Mumbai':  { pace_bias: 0.6, spin_bias: 0.4, avg_first_innings: 175, chase_win_pct: 0.52 },
  'Bengaluru': { pace_bias: 0.5, spin_bias: 0.5, avg_first_innings: 180, chase_win_pct: 0.55 },
  'Kolkata': { pace_bias: 0.4, spin_bias: 0.6, avg_first_innings: 170, chase_win_pct: 0.48 },
  'Delhi':   { pace_bias: 0.55, spin_bias: 0.45, avg_first_innings: 172, chase_win_pct: 0.50 },
  'Hyderabad': { pace_bias: 0.6, spin_bias: 0.4, avg_first_innings: 168, chase_win_pct: 0.47 },
  'Jaipur':  { pace_bias: 0.45, spin_bias: 0.55, avg_first_innings: 170, chase_win_pct: 0.49 },
  'Mohali':  { pace_bias: 0.6, spin_bias: 0.4, avg_first_innings: 174, chase_win_pct: 0.51 },
};

export class OddsEngine {

  // ── Pre-match Odds ──
  calculatePreMatchOdds(teamA, teamB, venue) {
    const ratingA = TEAM_RATINGS[teamA] || { elo: 1500, homeAdv: 1.0, recentForm: [0, 0, 0, 0, 0] };
    const ratingB = TEAM_RATINGS[teamB] || { elo: 1500, homeAdv: 1.0, recentForm: [0, 0, 0, 0, 0] };

    // 1. ELO probability
    const eloDiff = ratingA.elo - ratingB.elo;
    const eloProb = 1 / (1 + Math.pow(10, -eloDiff / 400));

    // 2. Form factor (last 5 matches)
    const formA = ratingA.recentForm.reduce((a, b) => a + b, 0) / 5;
    const formB = ratingB.recentForm.reduce((a, b) => a + b, 0) / 5;
    const formFactor = (formA - formB) * 0.1;

    // 3. Venue advantage
    const venueCity = Object.keys(VENUE_FACTORS).find(city => venue?.includes(city));
    const venueData = venueCity ? VENUE_FACTORS[venueCity] : null;
    const homeAdv = venue?.toLowerCase().includes(teamA.toLowerCase()) ? ratingA.homeAdv - 1 : 0;

    // 4. Composite probability
    let probA = Math.min(0.90, Math.max(0.10, eloProb + formFactor + homeAdv));
    let probB = 1 - probA;

    // 5. Apply margin (house edge for economy balance)
    const margin = 0.05;
    const oddsA = this.probabilityToOdds(probA, margin);
    const oddsB = this.probabilityToOdds(probB, margin);

    return {
      teamA: { code: teamA, probability: probA, odds: oddsA },
      teamB: { code: teamB, probability: probB, odds: oddsB },
      factors: { elo: eloDiff, formDiff: formFactor, homeAdvantage: homeAdv, venue: venueCity },
      confidence: Math.abs(eloDiff) > 50 ? 'high' : 'medium',
    };
  }

  // ── Live Odds Adjustment ──
  calculateLiveOdds(match, scoreData) {
    if (!scoreData || !scoreData.teamA) return null;

    const batting = scoreData.batting || match.teamA;
    const battingData = scoreData[batting === match.teamA ? 'teamA' : 'teamB'];
    const oversCompleted = battingData?.overs || 0;
    const runs = battingData?.runs || 0;
    const wickets = battingData?.wickets || 0;

    // Factors affecting live odds
    const factors = {};

    // Run rate analysis
    const currentRR = oversCompleted > 0 ? runs / oversCompleted : 0;
    const projectedTotal = currentRR * 20;
    factors.runRate = currentRR;
    factors.projectedTotal = projectedTotal;

    // Wicket pressure
    const wicketPressure = Math.pow(wickets / 10, 1.5); // exponential pressure
    factors.wicketPressure = wicketPressure;

    // Phase of game
    const phase = oversCompleted <= 6 ? 'powerplay' : oversCompleted <= 15 ? 'middle' : 'death';
    factors.phase = phase;

    // Target phase expectations
    const phaseExpectedRR = { powerplay: 8.5, middle: 7.0, death: 10.5 };
    const expectedRR = phaseExpectedRR[phase] || 8.0;
    factors.rrVsExpected = currentRR / expectedRR;

    // Calculate adjusted probability
    let battingTeamProb = 0.5;
    battingTeamProb += (currentRR - 8.0) * 0.03;           // RR above/below par
    battingTeamProb -= wicketPressure * 0.15;                // wicket impact
    battingTeamProb += (projectedTotal - 165) * 0.002;       // projected score vs average

    // Clamp
    battingTeamProb = Math.min(0.92, Math.max(0.08, battingTeamProb));

    // Add randomness for market simulation
    const jitter = (Math.random() - 0.5) * 0.04;
    battingTeamProb = Math.min(0.92, Math.max(0.08, battingTeamProb + jitter));

    const margin = 0.05;
    const battingOdds = this.probabilityToOdds(battingTeamProb, margin);
    const bowlingOdds = this.probabilityToOdds(1 - battingTeamProb, margin);

    return {
      battingTeam: { prob: battingTeamProb, odds: battingOdds },
      bowlingTeam: { prob: 1 - battingTeamProb, odds: bowlingOdds },
      factors,
    };
  }

  // ── Over/Under Market ──
  calculateTotalRunsOdds(projectedTotal, line = 340.5) {
    const diff = projectedTotal - line;
    const overProb = 1 / (1 + Math.exp(-diff / 20));
    const margin = 0.05;

    return {
      over: { label: `Over ${line}`, odds: this.probabilityToOdds(overProb, margin) },
      under: { label: `Under ${line}`, odds: this.probabilityToOdds(1 - overProb, margin) },
      projectedTotal,
    };
  }

  // ── Risk Assessment for Users ──
  assessPredictionRisk(prediction, market) {
    const option = market.options.find(o => o.key === prediction.selection);
    if (!option) return { riskLevel: 'unknown', riskScore: 0 };

    const impliedProb = 1 / option.odds;
    const stake = prediction.coinsStaked;
    const potentialPayout = stake * option.odds;

    let riskLevel, riskScore;

    if (impliedProb > 0.6) {
      riskLevel = 'low';
      riskScore = 0.2;
    } else if (impliedProb > 0.35) {
      riskLevel = 'medium';
      riskScore = 0.5;
    } else {
      riskLevel = 'high';
      riskScore = 0.8;
    }

    // Adjust for stake size
    if (stake > 2000) riskScore = Math.min(1, riskScore + 0.15);

    return {
      riskLevel,
      riskScore,
      impliedProbability: impliedProb,
      expectedValue: potentialPayout * impliedProb - stake * (1 - impliedProb),
      potentialPayout,
      kellyFraction: impliedProb > 0 ? (impliedProb * (option.odds - 1) - (1 - impliedProb)) / (option.odds - 1) : 0,
    };
  }

  // ── Utility ──
  probabilityToOdds(probability, margin = 0.05) {
    const trueOdds = 1 / probability;
    const adjustedOdds = trueOdds * (1 - margin);
    return Math.max(1.05, parseFloat(adjustedOdds.toFixed(2)));
  }

  // ── Match Outcome Prediction (ML placeholder) ──
  predictMatchOutcome(teamA, teamB, venue, historicalData = {}) {
    const odds = this.calculatePreMatchOdds(teamA, teamB, venue);

    return {
      prediction: odds.teamA.probability > 0.5 ? teamA : teamB,
      confidence: odds.confidence,
      probabilities: {
        [teamA]: (odds.teamA.probability * 100).toFixed(1) + '%',
        [teamB]: (odds.teamB.probability * 100).toFixed(1) + '%',
      },
      factors: odds.factors,
      suggestedBet: {
        team: odds.teamA.probability > 0.55 ? teamA : odds.teamB.probability > 0.55 ? teamB : 'skip',
        odds: odds.teamA.probability > 0.5 ? odds.teamA.odds : odds.teamB.odds,
        riskLevel: Math.abs(odds.teamA.probability - 0.5) > 0.15 ? 'low' : 'medium',
        reasoning: this.generateReasoning(odds),
      },
      modelVersion: '1.0.0',
      timestamp: new Date(),
    };
  }

  generateReasoning(odds) {
    const factors = odds.factors;
    const parts = [];
    if (Math.abs(factors.elo) > 40) parts.push(`ELO advantage: ${factors.elo > 0 ? 'Team A' : 'Team B'} (+${Math.abs(factors.elo)})`);
    if (Math.abs(factors.formDiff) > 0.05) parts.push(`Recent form favors ${factors.formDiff > 0 ? 'Team A' : 'Team B'}`);
    if (factors.homeAdvantage > 0) parts.push('Home advantage applicable');
    if (factors.venue) parts.push(`Venue: ${factors.venue}`);
    return parts.join('; ') || 'Balanced matchup';
  }
}

export const oddsEngine = new OddsEngine();
export default oddsEngine;
