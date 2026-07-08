# AGENTS.md — Looply Server

Reference doc for AI agents working in this repo. Read this instead of scanning the whole
tree. Update it whenever you change structure, conventions, or infra so it stays accurate.

## Stack

- **NestJS 11** (Express platform), **TypeScript**, **CommonJS** (not ESM — see Gotchas)
- **pnpm** package manager, **pnpm-workspace.yaml** for pnpm-level config (not `package.json`'s `pnpm` field — pnpm v10+ moved it)
- **PostgreSQL 17** via Docker Compose, accessed through **Prisma ORM 7** (driver adapter, no Rust query engine)
- **Clerk** (`@clerk/backend`) for authentication (session token verification, user management)
- **`@nestjs/throttler`** for global rate limiting (IP-keyed for anonymous, Clerk-user-keyed for authenticated)
- **Jest** for unit tests

## Project structure

```
prisma/
  schema.prisma            # User, Organization, ProcessedWebhookEvent models
prisma.config.ts           # Prisma CLI config (schema path, migrations path, env loading)
src/
  generated/prisma/        # generated Prisma Client (gitignored, regenerate with `pnpm exec prisma generate`)
  prisma/
    prisma.service.ts      # PrismaService — extends PrismaClient, uses @prisma/adapter-pg, connects in onModuleInit
    prisma.module.ts        # @Global module exporting PrismaService — already imported once in AppModule, inject it anywhere
  config/
    config.module.ts        # ConfigurationModule — wraps @nestjs/config's ConfigModule.forRoot(), isGlobal, loads .env.local then .env
    clerk-config/clerk-config.service.ts  # typed getters over ConfigService (secretKey, webhookSecret, publishableKey, port, frontendUrl, isDevelopment)
  clerk/
    clerk.module.ts
    clerk/clerk.service.ts  # wraps @clerk/backend's createClerkClient — session verification, user CRUD, org lookup, session revocation
  auth/
    auth.module.ts           # registers ClerkAuthGuard as the global APP_GUARD — every route requires auth by default
    guards/clerk-auth/clerk-auth.guard.ts   # ClerkAuthGuard — verifies Bearer token via ClerkService, attaches request.userId/sessionId; bypassed by @Public()
    decorators/clerk-user.decorator.ts      # @ClerkUserId(), @ClerkSessionId() param decorators, read what the guard attached
    decorators/public.decorator.ts          # @Public() — opt-in, per-route bypass of ClerkAuthGuard, for signature-verified webhooks only
  redis/
    redis.module.ts          # @Global() — owns the cache-purpose ioredis connection
    redis.service.ts         # RedisService — non-blocking connect (lazyConnect), isReady getter, never blocks boot if Redis is down
    redis-config/redis-config.service.ts  # isEnabled, host, port, password, db, keyPrefix, defaultTtlSeconds, connectTimeoutMs, maxRetriesPerRequest
  cache/
    cache.module.ts          # @Global(), exports CacheService
    cache.service.ts         # CacheService — get/set/del/getOrSet, cache-aside, swallows every Redis failure (never throws, never blocks a request)
    cache-key.util.ts        # buildCacheKey(entity, id, ...qualifiers) — the looply: prefix is applied by ioredis's own keyPrefix option, not here
  queue/
    queue.module.ts          # BullModule.forRootAsync (global connection, own ioredis client, QUEUE_REDIS_DB) + registerQueue per job type
    queue-config/queue-config.service.ts  # isEnabled, host/port/password/db, defaultJobOptions — fails fast at boot if QUEUE_ENABLED and host missing
    queue.constants.ts       # QUEUE_NAMES const object — the only place queue-name strings are defined
    queue-defaults.ts        # JOB_OPTIONS_BY_QUEUE — per-queue retry/backoff overrides
    processors/user-sync.processor.ts       # example/first processor, not currently enqueued from anywhere
    processors/billing-webhook.processor.ts # processes billing.sync jobs — DB-unique-constraint idempotency, see billing/ below
  users/
    users.module.ts          # imports ClerkModule (PrismaModule is global, no import needed)
    users.service.ts         # syncFromClerk(clerkId) — fetches Clerk profile + first org membership, upserts into local `users` table by clerkId
    users.controller.ts      # POST /users/sync — self-sync only, clerkId comes from @ClerkUserId() (the caller's own token), never from the request body
    dto/user-response.dto.ts       # UserResponseDto — Swagger DTO for the User row, includes nested organization
    dto/organization.dto.ts        # OrganizationDto — Swagger shape for the organization JSON snapshot (id, name, slug, imageUrl)
  rate-limit/
    rate-limit.module.ts                        # ThrottlerModule.forRootAsync (single 'default' throttler) + AppThrottlerGuard as global APP_GUARD
    rate-limit-config/rate-limit-config.service.ts  # typed getters over ConfigService — isEnabled, trustProxyHops, profiles (per-category ttl/limit, for docs/defaults)
    guards/app-throttler/app-throttler.guard.ts # AppThrottlerGuard — extends ThrottlerGuard, keys by request.userId (fallback: IP), sets Retry-After
    decorators/rate-limit.decorators.ts          # @AuthRateLimit()/@WriteRateLimit()/@AdminRateLimit()/@AiRateLimit()/@UploadRateLimit()/@WebhookRateLimit() override the default throttler's limit/ttl per-route; @SkipRateLimit() bypasses it
  billing/
    billing.module.ts             # registers BillingGuard as global APP_GUARD; own BullModule.registerQueue for BILLING_SYNC producer access
    billing.service.ts            # getUserBilling/getOrgBilling (DB+cache, lazy Clerk cold-fill), reconcile*Billing (webhook-driven), isEntitled (OR-logic across Solo+Org)
    billing.controller.ts         # GET /billing/status — caller's own entitlement snapshot, always accessible, never gated
    billing-webhook.controller.ts # POST /webhooks/clerk/billing — @Public(), svix-verified, enqueues to billing.sync
    billing-config/billing-config.service.ts  # soloPlanId/orgPlanId (default to the real cplan_ ids), webhookSecret (throws if missing)
    decorators/billing.decorators.ts  # @RequirePlan(...)/@RequireSoloPlan()/@RequireOrgPlan()
    guards/billing/billing.guard.ts   # metadata-driven, no-ops without @RequirePlan; reads request.userId
  common/
    interfaces/api-response.interface.ts    # ApiSuccessResponse<T> / ApiErrorResponse — the envelope shape, shared by both below
    interceptors/transform.interceptor.ts   # wraps every successful response in ApiSuccessResponse, registered globally in main.ts
    filters/all-exceptions.filter.ts        # @Catch() everything, logs, formats into ApiErrorResponse, registered globally in main.ts
    dto/api-response.dto.ts                 # ApiErrorResponseDto — class version of the error envelope, for Swagger schemas only
    decorators/api-standard-response.decorator.ts  # @ApiStandardResponse(Dto) — documents a route's response as the real envelope shape
  app.module.ts             # imports: ConfigurationModule, PrismaModule, ClerkModule, AuthModule, RateLimitModule, UsersModule (order matters — see below)
  main.ts                   # bootstrap: trust proxy, CORS (FRONTEND_URL + own port), global ValidationPipe, global TransformInterceptor + AllExceptionsFilter, Swagger at /docs, listen on PORT
docker-compose.yml          # postgres:17 service, env from .env.local, published on ${POSTGRES_PORT:-5432}
```

**Auth is global.** `AuthModule` registers `ClerkAuthGuard` via `{ provide: APP_GUARD, useClass: ClerkAuthGuard }`,
so every route in the app requires a valid Clerk Bearer token by default — including new controllers,
with no `@UseGuards(...)` needed. **`@Public()`** (`auth/decorators/public.decorator.ts`) opts a
specific route/controller out of this — `ClerkAuthGuard` injects `Reflector` and short-circuits
`canActivate` when the metadata is present. It is opt-in only (undecorated routes are completely
unaffected) and exists solely for signature-verified server-to-server receivers (see
`BillingWebhookController`) — never use it for anything a browser/user hits directly, since it
skips the session-token check entirely with no other gate unless the handler verifies something
itself (e.g. a webhook signature).

**Rate limiting and plan-gating are global too, and guard order matters.** `RateLimitModule`
registers `AppThrottlerGuard`, and `BillingModule` registers `BillingGuard`, as additional global
`APP_GUARD`s alongside `ClerkAuthGuard`. NestJS runs multiple `APP_GUARD` providers in the order
their owning modules appear in `AppModule.imports` — both **must** come after `AuthModule`.
`AppThrottlerGuard.getTracker()` and `BillingGuard.canActivate()` both read `request.userId`,
which only exists once `ClerkAuthGuard` has already run and set it. Reversing the import order
silently breaks per-user rate-limit tracking (falls back to IP) or plan-gating (`userId` is
`undefined`, every `@RequirePlan(...)` route is denied) with no error — nothing in the type system
catches this, so don't reorder `AppModule.imports` without keeping `AuthModule` first.
Only one throttler is actually registered with `ThrottlerModule` (named `default`) —
**`ThrottlerGuard` ANDs together every registered named throttler on every request**, so
registering all seven categories as separate throttlers would mean every route is capped by the
tightest one. Instead, every route gets the `default` profile unless decorated: `@WriteRateLimit()`,
`@AuthRateLimit()`, etc. (`rate-limit/decorators/rate-limit.decorators.ts`) override the `default`
throttler's limit/ttl for that route via `@Throttle({ default: { limit, ttl } })`, reading the
matching `RATE_LIMIT_<NAME>_*` env vars per-request (not at decoration time). `@SkipRateLimit()`
bypasses it entirely (internal/ops routes only). `BillingGuard` follows the identical
no-op-unless-decorated shape: `@RequireSoloPlan()`/`@RequireOrgPlan()`
(`billing/decorators/billing.decorators.ts`) gate a route; undecorated routes are unaffected.

**Redis is optional and non-blocking; the queue is not.** `RedisModule`/`CacheModule` wrap a
cache-purpose `ioredis` connection (`lazyConnect`, bounded retries, `enableOfflineQueue: false`) —
the app boots and serves every route normally even if Redis is completely down; `CacheService`
swallows every Redis failure and falls back to the real fetch (`AGENTS.md`'s single hardest
constraint for this subsystem). `QueueModule`'s BullMQ connection is a separate `ioredis` client on
a different logical DB (`QUEUE_REDIS_DB`, vs the cache's `REDIS_DB`) with the opposite defaults
(`enableOfflineQueue` left at its `true` default, `maxRetriesPerRequest: null` — required by BullMQ,
not a tuning choice) — a brief outage buffers `.add()` calls client-side rather than dropping them,
which is why a job enqueue must never be awaited unbounded in a latency-sensitive request path.

**Every HTTP response uses a standard envelope** (no third-party library — this is NestJS's own
documented interceptor/filter pattern, hand-rolled):
- Success: `TransformInterceptor` wraps whatever a controller returns as
  `{ success: true, statusCode, data, timestamp, path }`. Controllers just `return` their data as
  before — do not wrap it yourself, and do not write to `response` directly (bypasses the envelope).
- Error: `AllExceptionsFilter` catches everything (`@Catch()` with no type) and formats as
  `{ success: false, statusCode, message, error, timestamp, path }`. For `HttpException`s (thrown via
  `NotFoundException`, `UnauthorizedException`, etc., or by `ValidationPipe`) it forwards the
  exception's own `message`/`error`; anything else becomes a generic 500 with no internal details
  leaked to the client (the real error is still logged server-side).
- Both interfaces live in `common/interfaces/api-response.interface.ts` — reuse `ApiSuccessResponse<T>`
  if you need to type a response manually (e.g. in a test).

## API documentation (Swagger)

- `@nestjs/swagger` is wired up in `main.ts`: `DocumentBuilder` + `SwaggerModule.setup('docs', ...)`.
  Docs UI is at `/docs`, raw OpenAPI JSON at `/docs-json`.
- **Swagger is mounted directly on the HTTP adapter, so it bypasses the global `ClerkAuthGuard`** —
  `/docs` and `/docs-json` are reachable without a token. Every documented *route* still requires
  auth; use the "Authorize" button in the UI (bearer scheme id `clerk-session`) to try requests.
- Every controller needs `@ApiTags('Name')` and `@ApiBearerAuth('clerk-session')` at the class level.
- Every route needs `@ApiOperation({ summary })` plus a response decorator — **use
  `@ApiStandardResponse(SomeDto)` from `common/decorators/api-standard-response.decorator.ts`**,
  not raw `@ApiOkResponse`. It documents the actual wire shape (the `TransformInterceptor` envelope
  with `data: SomeDto`) and auto-adds a 401 response. Pass `{ isArray: true }` for list endpoints,
  primitives (`String`/`Number`/`Boolean`) work directly as `model`.
- Response/request DTOs must be **classes with `@ApiProperty()`**, not TS interfaces or types —
  Swagger reads decorator metadata, which only exists on classes. See
  `src/users/dto/user-response.dto.ts` for the pattern.
- Error envelope for docs is `ApiErrorResponseDto` (`common/dto/api-response.dto.ts`) — a
  class mirror of `ApiErrorResponse` kept in sync manually since interfaces carry no runtime metadata.

## Environment files

- `.env.local` is the real source of truth for local dev — gitignored, holds actual secrets
  (Clerk keys, `DATABASE_URL`, Postgres credentials). **Never commit it.**
- `.env` is a fallback only, loaded second. Don't rely on it for real values.
- Both the app (`ConfigurationModule` → `envFilePath: ['.env.local', '.env']`) and the Prisma
  CLI (`prisma.config.ts` explicitly calls `dotenv.config({ path: '.env.local' })` then
  `dotenv.config()`) load in the same order — keep it that way if you touch either file.
- The app and the Prisma CLI both run **on the host**, not inside Docker. `DATABASE_URL` /
  `POSTGRES_HOST` must point at `localhost`, not the Docker Compose service name (`postgres`)
  — that hostname only resolves from inside the compose network.
- All `RATE_LIMIT_*` vars and `TRUST_PROXY_HOPS` are optional with safe built-in defaults (unlike
  e.g. `CLERK_SECRET_KEY`, which throws if missing) — rate limiting works with zero `.env` changes.
- Same for `REDIS_*`/`QUEUE_*` (default to `localhost:6379`, cache/queue simply no-op if unset or
  Redis is down) and `BILLING_SOLO_PLAN_ID`/`BILLING_ORG_PLAN_ID` (default to the real Clerk
  dashboard plan IDs). **`BILLING_WEBHOOK_SECRET` is the one billing var that throws if missing** —
  but only when the webhook route is actually hit (`BillingConfigService.webhookSecret` is a
  getter read inside the handler, not at DI/boot time), so its absence never blocks app startup.

## Running locally

```bash
docker compose up -d postgres     # start Postgres (postgres:17, published on 5432)
pnpm install
pnpm exec prisma generate         # regenerate client after any schema.prisma change
pnpm start:dev                    # nest start --watch, boots on $PORT (default 5000)
```

`nest start --watch` spawns a detached child `node` process. If you kill the parent (e.g. a
background shell) rather than letting it exit normally, the child can orphan and hold the port,
producing `EADDRINUSE` on the next run. Recovery:
```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Prisma conventions

- Generator uses the new `prisma-client` provider (not `prisma-client-js`), with
  `moduleFormat = "cjs"` set explicitly — required because this project is CommonJS.
- Client output is `src/generated/prisma` (**inside `src/`**, not project-root `generated/`).
  This matters: TypeScript infers `rootDir` from the common ancestor of all compiled files, so
  if the generated client ever moves outside `src/`, `nest build` emits to `dist/src/main.js`
  instead of `dist/main.js`, breaking the `start:prod` script (`node dist/main.js`). Keep the
  generator output under `src/`.
- `prisma.config.ts` and the `prisma/` directory are excluded from `tsconfig.build.json` —
  they're consumed by the Prisma CLI's own loader, not by `nest build`.
- Instantiate the client only through `PrismaService` (`src/prisma/prisma.service.ts`), which
  wires `@prisma/adapter-pg` with `DATABASE_URL` from `ConfigService`. Don't `new PrismaClient()`
  elsewhere.
- Import the client as `from '../generated/prisma/client'` (or however many `../` levels apply)
  — there's no barrel `index.ts` in the generated output, `client` is the actual entry file.
- `prisma/schema.prisma` has one model so far: `User` (maps to table `users`, unique on
  `clerkId` and `email`) — the local mirror of a Clerk user, populated by `UsersService.syncFromClerk`.
  `organization` is a nullable `Json` snapshot (`{ id, name, slug, imageUrl }`) of the user's first
  Clerk organization membership (`ClerkService.getUserPrimaryOrganization`), refreshed on every sync
  — not a relational table, since we only need a denormalized display snapshot, not to query by org.
- **Setting a nullable `Json` field to "no value" needs `Prisma.DbNull`, not plain `null`.** Passing
  JS `null` for an optional `Json?` column is a type error (`NullableJsonNullValueInput` expects
  `Prisma.DbNull` for an actual database NULL, or `Prisma.JsonNull` for a stored JSON `null` literal
  — plain `null` satisfies neither). See `UsersService.syncFromClerk`'s `organization: organization ??
  Prisma.DbNull`.
- **After every `schema.prisma` edit, run `pnpm exec prisma generate` before building/running** —
  it is not automatic, and stale generated types fail `nest build` with confusing "no exported
  member" errors. `prisma migrate dev` regenerates as a side effect of creating a migration, but
  if you edit the schema without an accompanying migration (e.g. mid-edit) regenerate explicitly.
- To add a model: edit `prisma/schema.prisma`, then
  `pnpm exec prisma migrate dev --name <description>` (creates + applies a migration and regenerates).

## Adding new NestJS building blocks

Use the CLI to scaffold (correct structure, auto-registers in the target module):
```bash
nest g mo <name>              # module
nest g co <name> --no-spec    # controller
nest g s <name> --no-spec     # service
nest g gu <path/name> --no-spec   # guard
nest g d <path/name> --no-spec    # decorator
nest g res <name> --crud      # full CRUD resource (module+controller+service+dto+entity)
```
`--no-spec` skips generating a `.spec.ts` file. Prefer nesting under an existing feature
directory (e.g. `nest g s auth/services/foo`) over `--flat`.

## Gotchas (things that look fine but aren't)

1. **CommonJS, not ESM.** `package.json` has no `"type": "module"`. If something re-adds it
   (e.g. a future `prisma init` or a copy-pasted config), the entire codebase breaks at runtime
   with `ERR_MODULE_NOT_FOUND` — every relative import here is extensionless, which only
   resolves under CommonJS/Node's classic module resolution, not under Node's ESM loader. Do
   not add `"type": "module"` unless you also add explicit `.js` extensions to every relative
   import across `src/`.
2. **`docker-compose.yml` healthcheck** uses `$$POSTGRES_USER` (double `$`) deliberately — a
   single `$` gets interpolated by the Compose CLI itself from the *host* shell environment
   (not from `env_file:`), which is empty, silently breaking the healthcheck.
3. **Pin the Postgres image version** (currently `postgres:17`). `postgres:latest` can drift to
   a new major version on a fresh pull while an existing named volume still holds the old
   version's on-disk format, causing Postgres to crash-loop on startup. If this happens, the fix
   is `docker compose down -v` (drops the volume — confirm no real data first) then
   `docker compose up -d` on a pinned version.
4. **pnpm global installs of `@nestjs/cli`** can land `@nestjs/cli` and `@nestjs/schematics` in
   separate isolated pnpm store slots, breaking `nest new`/schematics resolution. If that error
   resurfaces, install `@nestjs/cli` globally via `npm` instead of `pnpm`.
5. **`unrs-resolver` / other native build scripts.** `pnpm-workspace.yaml`'s `allowBuilds` map
   controls which postinstall scripts run (`unrs-resolver: true`, `@scarf/scarf: false`,
   `@prisma/engines`/`prisma: false` — Prisma 7's driver-adapter setup needs no native engine
   binary). If `pnpm install`/`pnpm run build` fails with `ERR_PNPM_IGNORED_BUILDS`, a dependency
   was added without an entry here (or an entry has a placeholder value instead of a real
   boolean) — add/fix it in `pnpm-workspace.yaml`, not `package.json`'s `onlyBuiltDependencies`
   (pnpm v10+ ignores it there).
6. **Clerk: use `verifyToken`, never `clerkClient.sessions.verifySession`.** The latter is a
   deprecated endpoint — Clerk's API now returns `410 Gone` for every call, so every request
   would fail auth with a confusing "Session verification failed: Gone" log line. `ClerkService.
   verifySessionToken` (`src/clerk/clerk/clerk.service.ts`) calls the top-level `verifyToken`
   import from `@clerk/backend` instead, passing `secretKey` + `authorizedParties`. That top-level
   export has "legacy return" behavior — it resolves to the JWT payload directly (`{ sub, sid,
   ... }`) and throws on failure, rather than returning `{ data, errors }` like the lower-level
   `tokens/verify` signature suggests; don't destructure `{ data, errors }` from it.
7. **`authorizedParties` must include wherever the token's `azp` claim actually points, or every
   token gets rejected with "Invalid JWT Authorized party claim".** `ClerkConfigService.
   authorizedParties` (`src/config/clerk-config/clerk-config.service.ts`) always includes
   `FRONTEND_URL` and the app's own `http://localhost:${PORT}`, plus anything in
   `CLERK_AUTHORIZED_PARTIES` (comma-separated, `.env.local`). When testing without a real
   frontend by grabbing a token from Clerk's hosted **Account Portal**, `azp` is
   `https://<instance-slug>.accounts.dev` (not `localhost`) — add that origin to
   `CLERK_AUTHORIZED_PARTIES` or the token will always fail verification.
8. **`TRUST_PROXY_HOPS` must match actual infra topology, or rate-limit IP tracking is either
   broken or spoofable.** `main.ts` calls `app.getHttpAdapter().getInstance().set('trust proxy',
   ...)` — this affects `req.ip`/`req.ips` app-wide (anything reading client IP in the future, not
   just rate limiting), not a rate-limit-only setting. Defaults to `0` (off, safe for local dev
   where the app is hit directly). In production, set it to the *exact* number of reverse-proxy
   hops in front of the app (e.g. `1` for a single Nginx/ALB) — never trust an unbounded/`true`
   value, or a client can spoof `X-Forwarded-For` to bypass IP-based limits or impersonate another
   IP's bucket.
9. **Clerk's `cplan_...` plan ID is not the same identifier as a plan's dashboard "slug".** The
   backend billing API (`clerkClient.billing.*`, wrapped by `ClerkService.get*BillingSubscription`)
   and webhook payloads key subscription items by `planId` (`cplan_...`), which is what
   `BillingConfigService.soloPlanId`/`orgPlanId` and `BillingService` compare against. Clerk's
   frontend-only `has({ plan: 'slug' })` session-claim helper (not used anywhere in this backend)
   keys by a *different*, dashboard-configured slug string for the same plan — don't conflate the
   two if a frontend `has()` check is ever added later.
10. **Webhook signature verification needs the raw, unparsed request body — `main.ts` uses Nest's
    `rawBody: true` bootstrap option for this, not a route-scoped `express.raw()` middleware.**
    `NestFactory.create(AppModule, { rawBody: true })` is additive: every route still gets Nest's
    normal JSON-parsed `req.body` as before, it just *also* stashes the exact bytes on
    `req.rawBody`. `BillingWebhookController` reads `req.rawBody` (via `RawBodyRequest<Request>`)
    and verifies it with `svix`'s `Webhook.verify` directly — not `@clerk/backend/webhooks`'
    `verifyWebhook`, which expects a Fetch API `Request` object, awkward to bridge from Express's
    `req` on this platform. Never bind a validated DTO to a webhook body: the global
    `ValidationPipe`'s `forbidNonWhitelisted` would reject Clerk's payload shape.
11. **`BILLING_WEBHOOK_SECRET` is deliberately a different env var from the existing
    `CLERK_WEBHOOK_SECRET`** (`ClerkConfigService.webhookSecret`, still unused by any general
    webhook). Clerk issues a distinct signing secret per configured webhook endpoint in the
    dashboard — reusing the general secret for the billing endpoint would make every signature
    check fail once billing is configured as its own endpoint.
12. **Idempotency for billing webhooks is guaranteed by a DB unique constraint
    (`ProcessedWebhookEvent.svixId`), not by Redis.** `BillingWebhookController` enqueues with
    `jobId: svixId` (BullMQ's own cheap first-line dedupe against an immediate redelivery), but
    `BillingWebhookProcessor` writes the `ProcessedWebhookEvent` row *before* reconciling and treats
    a `P2002` (unique violation) as "already processed, skip" — this is the actual correctness
    guarantee. Redis/`CacheService` is explicitly optional and can no-op entirely, so it must never
    be load-bearing for correctness, only for performance.
13. **Jest needs a `moduleNameMapper` to resolve the generated Prisma client's imports.** The
    generated client (`src/generated/prisma/`) uses NodeNext-style relative imports with an
    explicit `.js` extension (e.g. `from "./internal/class.js"`), which `tsc`/`ts-node` resolve
    back to the `.ts` source automatically but Jest's own resolver does not. `package.json`'s
    `jest.moduleNameMapper` strips the trailing `.js` from relative imports
    (`"^(\\.{1,2}/.*)\\.js$": "$1"`) so any spec that transitively imports `PrismaService` (directly
    or via a service like `BillingService`) doesn't fail with `Cannot find module './internal/class.js'`.
    If a fresh `prisma generate` ever changes this import style, revisit this mapping.
