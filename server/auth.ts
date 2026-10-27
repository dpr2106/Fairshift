import crypto from 'crypto';
import express from 'express';
import { db } from './db.js';
import { User, UserRole } from './types.js';

const DEV_SECRET = 'fairshift-secret-key-prompt-wars-2026';

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (!secret) {
      throw new Error(
        'FATAL SECURITY MISCONFIGURATION: SESSION_SECRET is not defined in production. Server will not start with insecure session defaults.'
      );
    }
    if (secret === DEV_SECRET || secret.includes('prompt-wars-2026') || secret.length < 32) {
      throw new Error(
        'FATAL SECURITY MISCONFIGURATION: SESSION_SECRET in production cannot use the known development secret and must be at least 32 characters long.'
      );
    }
    return secret;
  }
  return secret || DEV_SECRET;
}

export function isDemoModeActive(): boolean {
  // Demo persona switching is restricted to development or when explicitly enabled via DEMO_MODE='true'
  return process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true';
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
  organizationId: string;
  issuedAt: number;
  expiresAt: number;
  isDemo?: boolean;
}

/**
 * Creates a signed cryptographic token for an authenticated user session.
 */
export function createSessionToken(user: User, isDemo = false): string {
  const secret = getSessionSecret();
  const payload: TokenPayload = {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours validity
    isDemo
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
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
    const secret = getSessionSecret();
    const expectedSig = crypto
      .createHmac('sha256', secret)
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
  tokenPayload?: TokenPayload;
}

/**
 * Express middleware requiring genuine server-verified authentication.
 * Checks Authorization header Bearer token or X-Session-Token.
 * Never accepts unverified headers (such as x-user-id) as proof of identity.
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
  req.tokenPayload = payload;
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
