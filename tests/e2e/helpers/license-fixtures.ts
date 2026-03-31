import type { Page } from "@playwright/test";

type ReleaseChannel = "stable" | "beta" | "internal";
type PlanType = "monthly" | "lifetime";
type AccessState =
  | "trial_active"
  | "payment_pending"
  | "active_monthly"
  | "active_lifetime"
  | "blocked"
  | "deleted";

const PLAN_OPTIONS = {
  monthly: {
    label: "Pro Mensal",
    amountInCents: 8_900,
  },
  lifetime: {
    label: "Founder Lifetime",
    amountInCents: 106_800,
  },
} as const;

function canAccessWorkspace(accessState: AccessState | null) {
  return (
    accessState === "trial_active" ||
    accessState === "payment_pending" ||
    accessState === "active_monthly" ||
    accessState === "active_lifetime"
  );
}

function requiresPayment(accessState: AccessState | null) {
  return accessState === "payment_pending" || accessState === "blocked";
}

function allowedChannelsFor(level: ReleaseChannel) {
  switch (level) {
    case "internal":
      return ["stable", "beta", "internal"] satisfies ReleaseChannel[];
    case "beta":
      return ["stable", "beta"] satisfies ReleaseChannel[];
    default:
      return ["stable"] satisfies ReleaseChannel[];
  }
}

export function createCharge(planType: PlanType, overrides?: Partial<Record<string, unknown>>) {
  const amount = planType === "monthly" ? PLAN_OPTIONS.monthly.amountInCents : PLAN_OPTIONS.lifetime.amountInCents;

  return {
    id: `charge_${planType}`,
    providerChargeId: `pix_${planType}`,
    planType,
    amount,
    status: "pending",
    dueAt: "2026-04-15T12:00:00.000Z",
    paidAt: null,
    qrCodePayload: {
      brCode: "000201FLOWMERGEPIX1234567890",
    },
    ...overrides,
  };
}

export function createLicensePayload({
  authenticated = true,
  releaseLevel = "stable" as ReleaseChannel,
  accessState = "trial_active" as AccessState | null,
  planType = null as PlanType | null,
  activeCharge = null as ReturnType<typeof createCharge> | null,
  shouldWipeLocalData = false,
  timeline,
  user,
}: {
  authenticated?: boolean;
  releaseLevel?: ReleaseChannel;
  accessState?: AccessState | null;
  planType?: PlanType | null;
  activeCharge?: ReturnType<typeof createCharge> | null;
  shouldWipeLocalData?: boolean;
  timeline?: Partial<{
    trialEndsAt: string | null;
    paymentDueAt: string | null;
    blockedAt: string | null;
    deleteAt: string | null;
  }>;
  user?: Partial<{
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
  }>;
} = {}) {
  const allowedChannels = allowedChannelsFor(releaseLevel);

  return {
    authenticated,
    canAccessWorkspace: authenticated ? canAccessWorkspace(accessState) : false,
    requiresPayment: authenticated ? requiresPayment(accessState) : false,
    shouldWipeLocalData,
    planType,
    accessState,
    user: authenticated
      ? {
          id: user?.id ?? "user_e2e_1",
          name: user?.name ?? "Maicon Teste",
          email: user?.email ?? "maicon@example.com",
          imageUrl: user?.imageUrl ?? null,
        }
      : null,
    timeline: {
      trialEndsAt: accessState === "trial_active" ? "2026-04-13T12:00:00.000Z" : null,
      paymentDueAt:
        accessState === "payment_pending" || accessState === "active_monthly"
          ? "2026-04-20T12:00:00.000Z"
          : null,
      blockedAt: accessState === "blocked" ? "2026-04-20T12:00:00.000Z" : null,
      deleteAt: accessState === "blocked" ? "2026-04-27T12:00:00.000Z" : null,
      ...timeline,
    },
    releaseAccess: {
      level: releaseLevel,
      allowedChannels,
    },
    billing: {
      planOptions: PLAN_OPTIONS,
      activeCharge,
    },
  };
}

export async function seedClientState(
  page: Page,
  licensePayload: ReturnType<typeof createLicensePayload>,
  options?: {
    releaseChannel?: ReleaseChannel;
  },
) {
  const releaseChannel = options?.releaseChannel ?? "stable";

  await page.addInitScript(
    ({ payload, channel }) => {
      window.localStorage.setItem("flow-merge-license-cache", JSON.stringify(payload));

      if (payload.user?.id) {
        window.localStorage.setItem("flow-merge-last-user-id", payload.user.id);
      }

      window.localStorage.setItem(
        "flow-merge-updater",
        JSON.stringify({
          enabled: false,
          repository: null,
          currentVersion: "0.1.8",
          releaseChannel: channel,
          supportedChannels: ["stable", "beta", "internal"],
          allowedChannels: payload.releaseAccess.allowedChannels,
          autoUpdateEnabled: true,
          updateState: "disabled",
          lastCheckedAt: null,
          pendingVersion: null,
          availableVersion: null,
          lastUpdateError: null,
          downloadedBytes: null,
          totalBytes: null,
          releaseNotes: null,
          publishedAt: null,
          checkIntervalMs: 3600000,
          feedUrls: {},
        }),
      );
    },
    {
      payload: licensePayload,
      channel: releaseChannel,
    },
  );
}

export async function seedWorkspaceArtifacts(
  page: Page,
  input?: {
    runtimeStore?: unknown;
    deepseekKey?: string;
    chatThreads?: unknown;
    activeChatId?: string;
  },
) {
  await page.addInitScript((payload) => {
    window.localStorage.setItem(
      "flow-merge-runtime-store",
      JSON.stringify(payload.runtimeStore ?? { project_1: { collections: { logs: [] } } }),
    );
    window.localStorage.setItem(
      "flow-merge-deepseek-key",
      payload.deepseekKey ?? "sk-local-test-key",
    );
    window.localStorage.setItem(
      "flow-merge-chat-threads",
      JSON.stringify(
        payload.chatThreads ?? [
          {
            id: "thread_1",
            title: "Conversa",
            messages: [],
            isStreaming: false,
            streamingMessageId: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      ),
    );
    window.localStorage.setItem(
      "flow-merge-active-chat-id",
      payload.activeChatId ?? "thread_1",
    );
  }, input ?? {});
}

export async function mockLicenseStatus(
  page: Page,
  getPayload: () => ReturnType<typeof createLicensePayload>,
) {
  await page.route("**/api/license/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(getPayload()),
    });
  });
}
