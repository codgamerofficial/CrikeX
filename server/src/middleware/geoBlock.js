import { RESTRICTED_STATES } from '../config/constants.js';

// Simulated GeoIP lookup (in production, use MaxMind GeoIP2 or similar)
function resolveStateFromIP(ip) {
  // For development, return null (no restriction)
  return null;
}

export function geoBlockMiddleware(req, res, next) {
  const userState = req.user?.stateCode;
  const ipState = resolveStateFromIP(req.ip);

  const stateToCheck = ipState || userState;

  if (stateToCheck && RESTRICTED_STATES.includes(stateToCheck)) {
    return res.status(451).json({
      error: 'SERVICE_UNAVAILABLE_IN_REGION',
      message: 'CrikeX is not available in your state due to local regulations.',
      restrictedState: stateToCheck,
      supportUrl: '/help/regional-restrictions',
    });
  }
  next();
}
