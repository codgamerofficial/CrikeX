import logger from '../utils/logger.js';

/**
 * Feature Flags Middleware
 * Controls feature rollout using environment variables
 */

/**
 * Check if feature is enabled globally or for specific user
 */
export function isFeatureEnabled(featureName, userId = null) {
  try {
    const envVar = `FEATURE_${featureName.toUpperCase()}`;
    const enabledFeatures = process.env[envVar];

    // If explicitly disabled
    if (enabledFeatures === 'false') {
      return false;
    }

    // If explicitly enabled (not gradual rollout)
    if (enabledFeatures === 'true') {
      return true;
    }

    // Gradual rollout: use userId for consistent assignment
    if (userId) {
      const rolloutVar = `ROLLOUT_${featureName.toUpperCase()}`;
      const rolloutPercentage = parseInt(process.env[rolloutVar] || 0);

      if (rolloutPercentage <= 0) return false;
      if (rolloutPercentage >= 100) return true;

      // Hash userId for consistent assignment
      const userHash = hashUserId(userId) % 100;
      return userHash < rolloutPercentage;
    }

    return false;
  } catch (error) {
    logger.error('Feature flag check failed', { featureName, error: error.message });
    return false; // Fail closed for safety
  }
}

/**
 * Check if feature is available in specific region
 */
export function isFeatureAvailableInRegion(featureName, stateCode) {
  try {
    const regionsVar = `FEATURE_${featureName.toUpperCase()}_REGIONS`;
    const enabledRegions = process.env[regionsVar]?.split(',') || [];

    return enabledRegions.length === 0 || enabledRegions.includes(stateCode);
  } catch (error) {
    logger.error('Regional feature check failed', { featureName, stateCode });
    return false;
  }
}

/**
 * Get all enabled features for user
 */
export function getEnabledFeaturesForUser(userId) {
  const features = [
    'ANALYTICS',
    'CONTESTS',
    'CAMPAIGNS',
    'LIVE_COMMENTARY',
    '2FA',
    'WITHDRAWALS',
    'RESPONSIBLE_GAMING',
  ];

  const enabledFeatures = {};

  features.forEach(feature => {
    enabledFeatures[feature.toLowerCase()] = isFeatureEnabled(feature, userId);
  });

  return enabledFeatures;
}

/**
 * Express middleware to inject feature checks
 */
export function featureFlagsMiddleware(req, res, next) {
  req.isFeatureEnabled = (featureName) => isFeatureEnabled(featureName, req.user?.id);
  req.isFeatureInRegion = (featureName) => isFeatureAvailableInRegion(featureName, req.user?.stateCode);
  req.getEnabledFeatures = () => getEnabledFeaturesForUser(req.user?.id);

  next();
}

/**
 * Hash userId to number for consistent feature assignment
 */
function hashUserId(userId) {
  let hash = 0;

  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash);
}

/**
 * Get feature rollout status (admin endpoint)
 */
export function getFeatureRolloutStatus() {
  const features = [
    'ANALYTICS',
    'CONTESTS',
    'CAMPAIGNS',
    'LIVE_COMMENTARY',
  ];

  const status = {};

  features.forEach(feature => {
    const enabledVar = `FEATURE_${feature}`;
    const rolloutVar = `ROLLOUT_${feature}`;
    const enabled = process.env[enabledVar];
    const rolloutPercentage = parseInt(process.env[rolloutVar] || 0);

    status[feature.toLowerCase()] = {
      enabled: enabled === 'true',
      rolloutPercentage: rolloutPercentage,
      status:
        enabled === 'false'
          ? 'disabled'
          : enabled === 'true'
            ? rolloutPercentage >= 100
              ? 'fully_enabled'
              : `rolling_out_${rolloutPercentage}%`
            : 'not_configured',
    };
  });

  return status;
}

/**
 * Feature flag examples:
 *
 * Full rollout:
 * FEATURE_ANALYTICS=true
 *
 * Gradual rollout:
 * FEATURE_ANALYTICS=true
 * ROLLOUT_ANALYTICS=50  (enable for 50% of users)
 *
 * Regional rollout:
 * FEATURE_ANALYTICS=true
 * FEATURE_ANALYTICS_REGIONS=IN-MH,IN-KA,IN-DL
 *
 * Disabled:
 * FEATURE_ANALYTICS=false
 *
 * Usage in code:
 * if (isFeatureEnabled('ANALYTICS', userId)) {
 *   // Analytics feature is available for this user
 * }
 */
