/**
 * Opaque cursor for keyset (cursor-based) pagination — encodes only the row
 * id, since orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] already makes
 * `id` a sufficient, unambiguous resume point via Prisma's cursor/skip
 * mechanism. Base64 (not a raw id) so callers never depend on the internal
 * id format and the server can evolve what the cursor encodes later without
 * breaking clients — same reasoning Stripe/GitHub apply to their own cursors.
 */
export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id })).toString('base64url');
}

/**
 * A malformed/stale cursor returns null rather than throwing — callers treat
 * that as "start from the first page," the more forgiving default for a read
 * endpoint than rejecting the request with 400.
 */
export function decodeCursor(cursor: string): { id: string } | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    const id = (parsed as { id?: unknown } | null)?.id;
    return typeof id === 'string' ? { id } : null;
  } catch {
    return null;
  }
}
