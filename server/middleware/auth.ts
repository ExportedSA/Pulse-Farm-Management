import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// JWT payload interface
export interface JWTPayload {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
  farmId?: string;
  iat?: number;
  exp?: number;
}

// Extended Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: RequestUser;
}

// Much of the route code reads `req.user.id`, so the user ID is exposed under both names
export type RequestUser = JWTPayload & { id: string };

function toRequestUser(payload: JWTPayload): RequestUser {
  return { ...payload, id: payload.userId };
}

/**
 * The signed-in user's ID (set by requireAuth/optionalAuth). The JWT payload calls it
 * `userId`; reading `req.user.id` always gives undefined.
 */
export function getUserId(req: Request): string | undefined {
  return (req as AuthenticatedRequest).user?.userId;
}

/**
 * The farm the signed-in user is working in, from their token
 */
export function getFarmId(req: Request): string | undefined {
  return (req as AuthenticatedRequest).user?.farmId;
}

/**
 * Use after requireAuth on farm-scoped routes. Tokens issued before a user joined a farm
 * have no farmId; signing in again picks the farm up.
 */
export function requireFarm(req: Request, res: Response, next: NextFunction) {
  if (!getFarmId(req)) {
    return res.status(403).json({
      error: 'No farm selected',
      message: 'Your account is not linked to a farm. Sign in again, or ask a farm owner to add you.',
    });
  }
  next();
}

// JWT Secret from environment
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

// Token expiration (1 day)
const JWT_EXPIRES_IN = '24h';

// Generate JWT token
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getJWTSecret(), { 
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256'
  });
}

// Generate refresh token (longer-lived)
export function generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getJWTSecret(), { 
    expiresIn: '7d',
    algorithm: 'HS256'
  });
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, getJWTSecret(), { algorithms: ['HS256'] }) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

// httpOnly cookie carrying the access token, so plain same-origin fetch() calls are authenticated
export const AUTH_COOKIE = 'pulse_token';

export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000, // matches JWT_EXPIRES_IN
  path: '/',
};

// Extract token from Authorization header, falling back to the auth cookie
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return extractCookieToken(req);

  // Expect "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

function extractCookieToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(';')) {
    const [name, ...rest] = pair.trim().split('=');
    if (name === AUTH_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

// JWT authentication middleware
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    const payload = verifyToken(token);
    req.user = toRequestUser(payload);
    
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return res.status(401).json({ 
      error: 'Authentication failed',
      message
    });
  }
}

// Optional authentication - doesn't fail if no token
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    
    if (token) {
      const payload = verifyToken(token);
      req.user = toRequestUser(payload);
    }
    
    next();
  } catch (error) {
    // Optional auth doesn't fail, just continues without user
    next();
  }
}

// Role-based access control
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `Role '${role}' required`
      });
    }
    
    next();
  };
}

// Multiple roles check
export function requireAnyRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'No token provided'
      });
    }
    
    if (!roles.includes(req.user.role || '') && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `One of roles [${roles.join(', ')}] required`
      });
    }
    
    next();
  };
}
