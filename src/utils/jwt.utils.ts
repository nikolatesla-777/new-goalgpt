import jwt from 'jsonwebtoken';

/**
 * JWT Utility Functions
 * Handles token generation, verification, and refresh
 */

export interface JWTPayload {
  userId: string;
  email: string;
  phone?: string | null;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h';
const JWT_REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d';

// FATAL: Require secrets in production
if (process.env.NODE_ENV === 'production') {
  if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production');
  }
  if (!JWT_REFRESH_SECRET) {
    throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required in production');
  }
}

// Development fallbacks (only for local development)
const EFFECTIVE_JWT_SECRET: string = JWT_SECRET || 'development-secret-change-in-production';
const EFFECTIVE_JWT_REFRESH_SECRET: string = JWT_REFRESH_SECRET || 'development-refresh-secret';

/**
 * Generate JWT access and refresh tokens
 * @param payload - User data to encode in token
 * @returns Token pair (access + refresh)
 */
export function generateTokens(payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair {
  // Generate access token (short-lived)
  const accessToken = jwt.sign(payload, EFFECTIVE_JWT_SECRET, {
    expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN,
  });

  // Generate refresh token (long-lived)
  const refreshToken = jwt.sign(
    {
      userId: payload.userId,
      tokenType: 'refresh',
    },
    EFFECTIVE_JWT_REFRESH_SECRET,
    {
      expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN,
    }
  );

  // Calculate expiration time in seconds
  const decoded = jwt.decode(accessToken) as jwt.JwtPayload;
  const expiresIn = decoded.exp! - decoded.iat!;

  return {
    accessToken,
    refreshToken,
    expiresIn,
  };
}

/**
 * Verify and decode JWT access token
 * @param token - JWT token to verify
 * @returns Decoded payload
 * @throws Error if token is invalid or expired
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as unknown as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_TOKEN');
    }
    throw error;
  }
}

/**
 * Verify and decode JWT refresh token
 * @param token - Refresh token to verify
 * @returns Decoded payload
 * @throws Error if token is invalid or expired
 */
export function verifyRefreshToken(token: string): { userId: string; tokenType: string } {
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_REFRESH_SECRET) as unknown as {
      userId: string;
      tokenType: string;
    };

    if (decoded.tokenType !== 'refresh') {
      throw new Error('INVALID_TOKEN_TYPE');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('INVALID_REFRESH_TOKEN');
    }
    throw error;
  }
}

/**
 * Decode JWT token without verification (for debugging)
 * ⚠️ Do not use for authentication - always verify first!
 * @param token - JWT token to decode
 * @returns Decoded payload or null
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 * @returns JWT token or null
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Check if token is expired (without verifying signature)
 * @param token - JWT token to check
 * @returns true if expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    if (!decoded || !decoded.exp) {
      return true;
    }
    return decoded.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Get token expiration date
 * @param token - JWT token
 * @returns Expiration date or null
 */
export function getTokenExpiration(token: string): Date | null {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  } catch {
    return null;
  }
}

export default {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  extractTokenFromHeader,
  isTokenExpired,
  getTokenExpiration,
};
