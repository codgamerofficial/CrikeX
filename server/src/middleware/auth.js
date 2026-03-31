import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants.js';
import { users } from '../data/store.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid token' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ error: 'ACCOUNT_BLOCKED', message: 'Your account has been suspended' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token is invalid or expired' });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = users.get(decoded.userId) || null;
  } catch (_) {}
  next();
}

export function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
  }
  next();
}
