"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTokens = generateTokens;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.decodeToken = decodeToken;
exports.extractTokenFromHeader = extractTokenFromHeader;
exports.isTokenExpired = isTokenExpired;
exports.getTokenExpiration = getTokenExpiration;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '1h';
const JWT_REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d';
// SECURITY: Require secrets in ALL environments (no fallbacks)
// This is a security-critical change - weak secrets are never acceptable
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in .env file.');
}
if (!JWT_REFRESH_SECRET) {
    throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is required. Set it in .env file.');
}
// No fallbacks - secrets must always be explicitly configured
const EFFECTIVE_JWT_SECRET = JWT_SECRET;
const EFFECTIVE_JWT_REFRESH_SECRET = JWT_REFRESH_SECRET;
/**
 * Generate JWT access and refresh tokens
 * @param payload - User data to encode in token
 * @returns Token pair (access + refresh)
 */
function generateTokens(payload) {
    // Generate access token (short-lived)
    const accessToken = jsonwebtoken_1.default.sign(payload, EFFECTIVE_JWT_SECRET, {
        expiresIn: JWT_ACCESS_TOKEN_EXPIRES_IN,
    });
    // Generate refresh token (long-lived)
    const refreshToken = jsonwebtoken_1.default.sign({
        userId: payload.userId,
        tokenType: 'refresh',
    }, EFFECTIVE_JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_TOKEN_EXPIRES_IN,
    });
    // Calculate expiration time in seconds
    const decoded = jsonwebtoken_1.default.decode(accessToken);
    const expiresIn = decoded.exp - decoded.iat;
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
function verifyAccessToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, EFFECTIVE_JWT_SECRET);
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new Error('TOKEN_EXPIRED');
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
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
function verifyRefreshToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, EFFECTIVE_JWT_REFRESH_SECRET);
        if (decoded.tokenType !== 'refresh') {
            throw new Error('INVALID_TOKEN_TYPE');
        }
        return decoded;
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            throw new Error('REFRESH_TOKEN_EXPIRED');
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
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
function decodeToken(token) {
    try {
        return jsonwebtoken_1.default.decode(token);
    }
    catch {
        return null;
    }
}
/**
 * Extract token from Authorization header
 * @param authHeader - Authorization header value
 * @returns JWT token or null
 */
function extractTokenFromHeader(authHeader) {
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
function isTokenExpired(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || !decoded.exp) {
            return true;
        }
        return decoded.exp * 1000 < Date.now();
    }
    catch {
        return true;
    }
}
/**
 * Get token expiration date
 * @param token - JWT token
 * @returns Expiration date or null
 */
function getTokenExpiration(token) {
    try {
        const decoded = jsonwebtoken_1.default.decode(token);
        if (!decoded || !decoded.exp) {
            return null;
        }
        return new Date(decoded.exp * 1000);
    }
    catch {
        return null;
    }
}
exports.default = {
    generateTokens,
    verifyAccessToken,
    verifyRefreshToken,
    decodeToken,
    extractTokenFromHeader,
    isTokenExpired,
    getTokenExpiration,
};
