import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { getServerEnv, getTrustedOrigins } from "@/lib/server-env";
import { defaultTrialEndsAt } from "@/lib/server/license-service";
import { prisma } from "@/lib/prisma";

const env = getServerEnv();

export const auth = betterAuth({
  appName: "Flow Merge",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: getTrustedOrigins(),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      prompt: "select_account",
    },
  },
  user: {
    additionalFields: {
      planType: {
        type: "string",
        required: false,
        input: false,
      },
      accessState: {
        type: "string",
        input: false,
        defaultValue: "trial_active",
      },
      releaseRole: {
        type: "string",
        input: false,
        defaultValue: "stable",
      },
      trialEndsAt: {
        type: "date",
        required: false,
        input: false,
        defaultValue: () => defaultTrialEndsAt(),
      },
      paymentDueAt: {
        type: "date",
        required: false,
        input: false,
      },
      blockedAt: {
        type: "date",
        required: false,
        input: false,
      },
      deleteAt: {
        type: "date",
        required: false,
        input: false,
      },
      isActive: {
        type: "boolean",
        input: false,
        defaultValue: true,
      },
    },
  },
  plugins: [nextCookies()],
});
