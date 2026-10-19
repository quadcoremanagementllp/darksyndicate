import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { BCRYPT_ROUNDS } from './constants';

// ─── Password Hashing ───────────────────────────────────────────────────────

/**
 * Hash a plaintext password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── JWT Token Management ───────────────────────────────────────────────────

export interface TokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT access token.
 */
export async function createAccessToken(
  payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss'>
): Promise<string> {
  const expiry = process.env.JWT_ACCESS_EXPIRY || '30d';

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setIssuer('dark-syndicate')
    .sign(getJwtSecret());
}

/**
 * Create a signed JWT refresh token (longer-lived).
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const expiry = process.env.JWT_REFRESH_EXPIRY || '60d';

  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setIssuer('dark-syndicate')
    .sign(getJwtSecret());
}

/**
 * Verify and decode a JWT token.
 * Returns null if token is invalid or expired (does not throw).
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: 'dark-syndicate',
    });
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

// ─── Secure Random Token ────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure random token for password resets, etc.
 */
export function generateSecureToken(length: number = 64): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  );
}
