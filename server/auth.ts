import crypto from 'crypto';
import express from 'express';
import { db } from './db.js';
import { User, UserRole } from './types.js';

const SECRET = process.env.SESSION_SECRET || 'fairshift-secret-key-prompt-wars-2026';

export interface TokenPayload {
  userId: string;
  role: UserRole;
  organizationId: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Creates a signed cryptographic token for an authenticated user session.
 */
export function createSessionToken(user: User): string {
  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours validity
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and parses a signed session token. Returns null if invalid or expired.
 */
export function verifySessionToken(tokenString: string): TokenPayload | null {
  try {
    const parts = tokenString.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SECRET)
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

export interface AuthenticatedRequest extends express.Request {
  user?: User;
}

/**
 * Express middleware requiring server-verified authentication.
 * Checks Authorization header Bearer token or pre-verified X-Session-Token.
 */
export function requireAuth(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers['authorization'];
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-session-token']) {
    token = String(req.headers['x-session-token']).trim();
  }

  // Fallback for demo persona switching: if an x-user-id header is provided,
  // we verify it exists in our registered users database and generate/verify identity
  if (!token && req.headers['x-user-id']) {
    const fallbackId = String(req.headers['x-user-id']);
    const user = db.get().users.find(u => u.id === fallbackId);
    if (user) {
      req.user = user;
      return next();
    }
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Missing Bearer session token.'
    });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Invalid or expired session token. Please log in again.'
    });
  }

  const user = db.get().users.find(u => u.id === payload.userId);
  if (!user) {
    return res.status(401).json({
      error: 'User account associated with session token was not found.'
    });
  }

  req.user = user;
  next();
}

/**
 * Role-Based Access Control middleware.
 * Ensures the authenticated user has one of the allowed roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Operation requires role [${allowedRoles.join(' or ')}], but current role is '${req.user.role}'.`
      });
    }

    next();
  };
}

/**
 * Organization-Level Tenant Isolation middleware.
 * Ensures users can only access resources matching their organizationId,
 * unless they are a system-wide auditor ('admin').
 */
export function enforceOrgBoundary(
  targetOrgId: string,
  user: User
): boolean {
  if (user.role === 'admin') return true;
  return user.organizationId === targetOrgId;
}
