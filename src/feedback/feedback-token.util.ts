import { createHmac, randomBytes } from 'crypto';

/**
 * 256 bits of CSPRNG entropy — brute-forcing it is infeasible at any
 * per-guess cost, which is why it's hashed with a fast keyed hash (HMAC)
 * below rather than a slow password hash (bcrypt/argon2): a slow hash
 * defends against low-entropy secrets, not this.
 */
export function generateFeedbackToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Deterministic (unlike bcrypt/argon2's per-call salting) so it stays an O(1)
 * indexed `where: { tokenHash }` lookup. Keyed with a server-held pepper so a
 * database-only leak (without the app secret) can't be used to derive or
 * verify a token.
 */
export function hashFeedbackToken(token: string, pepper: string): string {
  return createHmac('sha256', pepper).update(token).digest('hex');
}
