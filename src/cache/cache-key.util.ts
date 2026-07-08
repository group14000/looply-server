/**
 * Builds a cache key as "<entity>:<id>[:<qualifier>]". The `looply:` prefix
 * is applied transparently by RedisService's ioredis `keyPrefix` option, not
 * here — callers only ever deal with the entity-scoped part.
 */
export function buildCacheKey(
  entity: string,
  id: string,
  ...qualifiers: string[]
): string {
  return [entity, id, ...qualifiers].join(':');
}
