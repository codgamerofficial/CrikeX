import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/constants.js';
import { getUserProfile } from '../services/appwriteClient.js';

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid token' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user data from Appwrite
    const user = await getUserProfile(decoded.userId);
    
    if (!user) return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ error: 'ACCOUNT_BLOCKED', message: 'Your account has been suspended' });
    
    req.user = user;
    next();
  } catch (err) {
    if (err.message === 'jwt expired') {
      return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token is invalid or expired' });
    }
    // Handle Appwrite DocumentNotFoundException
    if (err.code === 404) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'User profile not found' });
    }
    console.error('[Auth Error]:', err.message);
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication failed' });
  }
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserProfile(decoded.userId);
    if (user && !user.isBlocked) req.user = user;
  } catch (_) {}
  
  next();
}

export function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
  }
  next();
}
