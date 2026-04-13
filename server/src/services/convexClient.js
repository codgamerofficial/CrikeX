/**
 * Convex HTTP Client (Server-side)
 * Used by the API Gateway to interact with Convex (admin tasks, orchestrations)
 *
 * IMPORTANT: This must connect to your Convex deployment
 * Get your URL from: https://dashboard.convex.dev/
 */
import { ConvexHttpClient } from 'convex/browser';
import logger from '../utils/logger.js';

let convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

if (!convexUrl || convexUrl === 'https://example.convex.cloud') {
  logger.error('CONVEX_URL not configured!', {
    current: convexUrl,
    instruction: 'Set CONVEX_URL environment variable. Get it from https://dashboard.convex.dev/',
  });

  // Use a placeholder that will throw clear errors when called
  convexUrl = 'https://placeholder.convex.cloud';
}

export const convex = new ConvexHttpClient(convexUrl);

/**
 * Sync match updates from Admin to Convex
 */
export async function upsertMatchToConvex(matchData) {
  try {
    if (!convexUrl || convexUrl.includes('placeholder') || convexUrl.includes('example')) {
      throw new Error('Convex URL not properly configured. Please set CONVEX_URL environment variable.');
    }

    logger.debug('Upserting match to Convex', { matchId: matchData.id });

    return await convex.mutation('matches:upsert', matchData);
  } catch (err) {
    logger.error('Convex match upsert error', {
      error: err.message,
      matchId: matchData?.id,
    });
    throw err;
  }
}

/**
 * Trigger market settlement in Convex
 */
export async function settleMarketInConvex(marketId, result) {
  try {
    if (!convexUrl || convexUrl.includes('placeholder') || convexUrl.includes('example')) {
      throw new Error('Convex URL not properly configured. Please set CONVEX_URL environment variable.');
    }

    logger.debug('Settling market in Convex', { marketId, result });

    return await convex.mutation('betting:settleMarket', { marketId, result });
  } catch (err) {
    logger.error('Convex market settlement error', {
      error: err.message,
      marketId,
    });
    throw err;
  }
}

/**
 * Test Convex connection
 */
export async function testConvexConnection() {
  try {
    if (!convexUrl || convexUrl.includes('placeholder') || convexUrl.includes('example')) {
      return {
        success: false,
        error: 'Convex URL not configured',
        message: 'Set CONVEX_URL environment variable',
      };
    }

    // Try to fetch a simple query to test connection
    const result = await convex.query('public:getStatus');

    logger.info('Convex connection successful', { url: convexUrl });

    return { success: true, url: convexUrl };
  } catch (error) {
    logger.error('Convex connection test failed', {
      error: error.message,
      url: convexUrl,
    });

    return {
      success: false,
      error: error.message,
      url: convexUrl,
    };
  }
}

export default convex;
