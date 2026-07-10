/**
 * Public capability-token routes (e.g. /public/feedback/:token) carry a live,
 * replayable secret in the URL path itself. AllExceptionsFilter and
 * TransformInterceptor both echo request.url verbatim into logs and every
 * response's `path` field — without this, that would write the secret into
 * application logs and every response body for the route. Extend the regex
 * if another capability-token route family is ever added.
 */
export function redactSensitivePath(path: string): string {
  return path.replace(/^(\/public\/feedback)\/[^/?]+/, '$1/[redacted]');
}
