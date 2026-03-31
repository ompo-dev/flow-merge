import "server-only";

type RateLimitBucket = "auth" | "billing" | "license";

interface RateLimitPolicy {
  limit: number;
  windowMs: number;
  error: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

const RATE_LIMIT_POLICIES: Record<RateLimitBucket, RateLimitPolicy> = {
  auth: {
    limit: 60,
    windowMs: 60_000,
    error: "Muitas tentativas de autenticacao. Aguarde alguns instantes.",
  },
  billing: {
    limit: 20,
    windowMs: 60_000,
    error: "Muitas operacoes de cobranca em pouco tempo. Tente novamente em instantes.",
  },
  license: {
    limit: 180,
    windowMs: 60_000,
    error: "Muitas consultas de licenca em pouco tempo. Aguarde alguns instantes.",
  },
};

declare global {
  var __flowMergeRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const rateLimitStore = globalThis.__flowMergeRateLimitStore ?? new Map<string, RateLimitEntry>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__flowMergeRateLimitStore = rateLimitStore;
}

function getForwardedIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("fly-client-ip") ??
    "unknown"
  );
}

function pruneExpiredEntries(now: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function buildRateLimitKey(bucket: RateLimitBucket, request: Request, userId?: string | null) {
  const clientId = userId?.trim() || getForwardedIp(request);
  return `${bucket}:${clientId}`;
}

export function consumeRateLimit(
  bucket: RateLimitBucket,
  request: Request,
  userId?: string | null,
  now = Date.now(),
): RateLimitResult {
  pruneExpiredEntries(now);

  const policy = RATE_LIMIT_POLICIES[bucket];
  const key = buildRateLimitKey(bucket, request, userId);
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + policy.windowMs,
    });

    return {
      allowed: true,
      remaining: policy.limit - 1,
      retryAfterSeconds: Math.ceil(policy.windowMs / 1000),
      limit: policy.limit,
    };
  }

  if (current.count >= policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      limit: policy.limit,
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - current.count),
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    limit: policy.limit,
  };
}

export function buildRateLimitResponse(bucket: RateLimitBucket, result: RateLimitResult) {
  const policy = RATE_LIMIT_POLICIES[bucket];
  return Response.json(
    { error: policy.error },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

export function enforceRateLimit(
  bucket: RateLimitBucket,
  request: Request,
  userId?: string | null,
) {
  const result = consumeRateLimit(bucket, request, userId);
  if (result.allowed) return null;
  return buildRateLimitResponse(bucket, result);
}

export function resetRateLimitStore() {
  rateLimitStore.clear();
}
