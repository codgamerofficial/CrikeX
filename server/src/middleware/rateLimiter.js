import rateLimit from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
});

export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: 'RATE_LIMITED', message: 'Too many auth attempts, please try again in 5 minutes.' },
});

export const predictionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { error: 'RATE_LIMITED', message: 'Prediction limit reached. Please slow down.' },
});
