import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const authHandlers = toNextJsHandler(auth);

function withAuthRateLimit(handler: (request: Request) => Promise<Response>) {
  return async function rateLimitedHandler(request: Request) {
    const rateLimited = enforceRateLimit("auth", request);
    if (rateLimited) return rateLimited;
    return handler(request);
  };
}

export const GET = withAuthRateLimit(authHandlers.GET);
export const POST = withAuthRateLimit(authHandlers.POST);
export const PATCH = withAuthRateLimit(authHandlers.PATCH);
export const PUT = withAuthRateLimit(authHandlers.PUT);
export const DELETE = withAuthRateLimit(authHandlers.DELETE);
