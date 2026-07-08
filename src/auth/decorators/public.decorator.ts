import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opt-in, per-route bypass of the global ClerkAuthGuard — for signature-
 * verified webhook receivers, never for anything a browser/user hits directly. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
