import axios from 'axios';
import logger from '../utils/logger.js';
import { get, set } from '../services/redis.js';

/**
 * GeoIP lookup service
 * Uses free MaxMind GeoIP2 Lite database or IP2Location API
 *
 * For production, integrate with:
 * - MaxMind GeoIP2 (https://dev.maxmind.com/)
 * - IP2Location (https://www.ip2location.com/)
 * - db-ip.com
 */

const GEOIP_CACHE_TTL = 24 * 60 * 60; // 24 hours

/**
 * Resolve state code from IP address using free API
 * Supported APIs:
 * - ip-api.com (free tier, 45 req/min)
 * - ipapi.co (free tier, account required)
 * - geoip-db.com (free tier)
 */
export async function resolveStateFromIP(ipAddress) {
  if (!ipAddress || ipAddress === 'localhost' || ipAddress.startsWith('127.')) {
    return null; // Local request, no geo restriction
  }

  try {
    // Check cache first
    const cacheKey = `geoip:${ipAddress}`;
    const cached = await get(cacheKey);

    if (cached) {
      logger.debug('GeoIP cache hit', { ip: ipAddress, state: cached });
      return JSON.parse(cached);
    }

    // Call free GeoIP API (ip-api.com)
    const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
      timeout: 5000,
      params: {
        fields: 'country,countryCode,regionName,region',
      },
    });

    if (response.data.status === 'fail') {
      logger.warn('GeoIP lookup failed', { ip: ipAddress, reason: response.data.message });
      return null;
    }

    // Map state to India state code (ISO 3166-2)
    const stateCode = mapStateToCode(response.data.region, response.data.countryCode);

    logger.info('GeoIP lookup successful', {
      ip: ipAddress,
      country: response.data.country,
      region: response.data.regionName,
      state: stateCode,
    });

    // Cache the result
    await set(cacheKey, JSON.stringify(stateCode), GEOIP_CACHE_TTL);

    return stateCode;
  } catch (error) {
    logger.error('GeoIP resolution failed', {
      ip: ipAddress,
      error: error.message,
    });

    // Don't block on geo lookup failure - return null (allow access)
    return null;
  }
}

/**
 * Map region name/code to India state code
 * Uses ISO 3166-2 format: IN-XX (e.g., IN-AP for Andhra Pradesh)
 */
function mapStateToCode(regionName, countryCode) {
  // Only apply restrictions for India
  if (countryCode !== 'IN') {
    return null;
  }

  const stateMapping = {
    // Common names and codes
    'Andhra Pradesh': 'IN-AP',
    'Arunachal Pradesh': 'IN-AR',
    'Assam': 'IN-AS',
    'Bihar': 'IN-BR',
    'Chhattisgarh': 'IN-CG',
    'Goa': 'IN-GA',
    'Gujarat': 'IN-GJ',
    'Haryana': 'IN-HR',
    'Himachal Pradesh': 'IN-HP',
    'Jharkhand': 'IN-JH',
    'Karnataka': 'IN-KA',
    'Kerala': 'IN-KL',
    'Madhya Pradesh': 'IN-MP',
    'Maharashtra': 'IN-MH',
    'Manipur': 'IN-MN',
    'Meghalaya': 'IN-ML',
    'Mizoram': 'IN-MZ',
    'Nagaland': 'IN-NL',
    'Odisha': 'IN-OD',
    'Punjab': 'IN-PB',
    'Rajasthan': 'IN-RJ',
    'Sikkim': 'IN-SK',
    'Tamil Nadu': 'IN-TN',
    'Telangana': 'IN-TG',
    'Tripura': 'IN-TR',
    'Uttar Pradesh': 'IN-UP',
    'Uttarakhand': 'IN-UT',
    'West Bengal': 'IN-WB',
    // Union Territories
    'Andaman and Nicobar': 'IN-AN',
    'Chandigarh': 'IN-CH',
    'Dadra and Nagar Haveli and Daman and Diu': 'IN-DD',
    'Lakshadweep': 'IN-LD',
    'Delhi': 'IN-DL',
    'Puducherry': 'IN-PY',
    'Ladakh': 'IN-LA',
    'Jammu and Kashmir': 'IN-JK',
    // Abbreviations and alternate names
    'AP': 'IN-AP',
    'TS': 'IN-TG',
    'AS': 'IN-AS',
    'SK': 'IN-SK',
    'NL': 'IN-NL',
  };

  const stateCode = stateMapping[regionName];

  if (stateCode) {
    logger.debug('State mapped', { region: regionName, code: stateCode });
    return stateCode;
  }

  logger.warn('State mapping not found', { region: regionName });
  return null;
}

/**
 * Check if state is restricted for betting
 */
export function isStateRestricted(stateCode) {
  // Restricted states for fantasy sports/betting in India
  const restrictedStates = [
    'IN-AP', // Andhra Pradesh
    'IN-TG', // Telangana
    'IN-AS', // Assam
    'IN-SK', // Sikkim
    'IN-NL', // Nagaland
  ];

  return restrictedStates.includes(stateCode);
}

/**
 * Get readable restriction reason for state
 */
export function getRestrictionReason(stateCode) {
  const reasons = {
    'IN-AP': 'Fantasy sports betting is not permitted in Andhra Pradesh. Please contact support for assistance.',
    'IN-TG': 'Fantasy sports betting is not permitted in Telangana. Please contact support for assistance.',
    'IN-AS': 'Fantasy sports betting is not permitted in Assam. Please contact support for assistance.',
    'IN-SK': 'Fantasy sports betting is not permitted in Sikkim. Please contact support for assistance.',
    'IN-NL': 'Fantasy sports betting is not permitted in Nagaland. Please contact support for assistance.',
  };

  return reasons[stateCode] || 'Your region is not eligible for this service.';
}

/**
 * Verify user's registered state vs actual location
 * Returns true if locations match or no conflict
 */
export async function verifyUserLocation(userRegisteredState, userIP) {
  try {
    const actualState = await resolveStateFromIP(userIP);

    if (!actualState || !userRegisteredState) {
      return true; // Allow if no state info available
    }

    // If states differ significantly (not same state), log for fraud detection
    if (actualState !== userRegisteredState) {
      logger.warn('User location mismatch detected', {
        registered: userRegisteredState,
        actual: actualState,
        ip: userIP,
      });

      // For now, allow but flag for review
      // In production, could implement stronger verification
      return true;
    }

    return true;
  } catch (error) {
    logger.error('Location verification failed', { error: error.message });
    return true; // Default to allow on error
  }
}
