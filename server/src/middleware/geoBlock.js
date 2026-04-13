import { RESTRICTED_STATES } from '../config/constants.js';
import { resolveStateFromIP, isStateRestricted, getRestrictionReason } from '../services/geoipProvider.js';
import logger from '../utils/logger.js';

/**
 * Middleware to block access from restricted states
 * Applied to sensitive endpoints (prediction placement, deposits, etc.)
 */
export async function geoBlockMiddleware(req, res, next) {
  try {
    const userState = req.user?.stateCode;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Get state from IP lookup
    const ipState = await resolveStateFromIP(clientIP);

    // Check registered state first, then IP state
    const stateToCheck = ipState || userState;

    if (!stateToCheck) {
      // No state info available, allow access
      return next();
    }

    // Check if state is in restricted list
    if (isStateRestricted(stateToCheck)) {
      logger.warn('Access denied - restricted state', {
        userId: req.user?.id,
        state: stateToCheck,
        ip: clientIP,
      });

      return res.status(451).json({
        error: 'SERVICE_UNAVAILABLE_IN_REGION',
        message: getRestrictionReason(stateToCheck),
        restrictedState: stateToCheck,
        supportUrl: '/help/regional-restrictions',
      });
    }

    // If IP state differs from registered state, log for monitoring
    if (ipState && userState && ipState !== userState) {
      logger.info('User accessing from different state', {
        userId: req.user?.id,
        registered: userState,
        current: ipState,
        ip: clientIP,
      });
    }

    next();
  } catch (error) {
    logger.error('GeoBlock middleware error', { error: error.message });
    // On error, allow access (fail-safe)
    next();
  }
}

/**
 * Alternative: Synchronous version that checks registered state only
 * Use this if async operations cause issues
 */
export function geoBlockMiddlewareSync(req, res, next) {
  const userState = req.user?.stateCode;

  if (userState && isStateRestricted(userState)) {
    logger.warn('Access denied - restricted state (sync)', {
      userId: req.user?.id,
      state: userState,
    });

    return res.status(451).json({
      error: 'SERVICE_UNAVAILABLE_IN_REGION',
      message: getRestrictionReason(userState),
      restrictedState: userState,
      supportUrl: '/help/regional-restrictions',
    });
  }

  next();
}
