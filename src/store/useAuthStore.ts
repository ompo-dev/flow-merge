"use client";

import { AxiosError } from "axios";
import { create } from "zustand";
import { authClient } from "@/lib/auth-client";
import { apiClient } from "@/lib/http-client";
import {
  PLAN_PRICING,
  type LicenseStatusPayload,
  type PlanType,
} from "@/lib/license";
import { deleteSetting, getSetting, setSetting } from "@/lib/storage/settings-store";
import { useFlowStore } from "@/store/useFlowStore";

interface AuthResult {
  success: boolean;
  error?: string;
}

interface BillingChargeResult extends AuthResult {
  charge?: LicenseStatusPayload["billing"]["activeCharge"];
}

interface AuthState {
  hydrated: boolean;
  pending: boolean;
  billingPending: boolean;
  accountPending: boolean;
  session: LicenseStatusPayload["user"] | null;
  license: LicenseStatusPayload;
  hydrate: () => Promise<void>;
  refreshStatus: () => Promise<LicenseStatusPayload>;
  loginWithGoogle: () => Promise<AuthResult>;
  requestBillingCharge: (planType: PlanType) => Promise<BillingChargeResult>;
  simulatePayment: (planType: PlanType) => Promise<AuthResult>;
  cancelSubscription: () => Promise<AuthResult>;
  logout: () => Promise<void>;
}

function createAnonymousLicenseState(): LicenseStatusPayload {
  return {
    authenticated: false,
    canAccessWorkspace: false,
    requiresPayment: false,
    shouldWipeLocalData: false,
    planType: null,
    accessState: null,
    user: null,
    timeline: {
      trialEndsAt: null,
      paymentDueAt: null,
      blockedAt: null,
      deleteAt: null,
    },
    releaseAccess: {
      level: "stable",
      allowedChannels: ["stable"],
    },
    billing: {
      planOptions: PLAN_PRICING,
      activeCharge: null,
    },
  };
}

function readCachedLicenseState() {
  return createAnonymousLicenseState();
}

function persistLicenseState(payload: LicenseStatusPayload) {
  if (typeof window === "undefined") return;

  void setSetting("license-cache", payload).catch(() => {});

  if (payload.user?.id) {
    void setSetting("last-user-id", payload.user.id).catch(() => {});
    return;
  }

  if (!payload.authenticated) {
    void deleteSetting("license-cache").catch(() => {});
  }
}

async function getLastAuthenticatedUserId() {
  const persisted = await getSetting("last-user-id");
  if (persisted) return persisted;
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("flow-merge-last-user-id");
}

async function wipeLocalWorkspace() {
  await useFlowStore.getState().resetLocalWorkspace();
}

function normalizeLicensePayload(payload: LicenseStatusPayload) {
  return {
    ...payload,
    billing: {
      planOptions: PLAN_PRICING,
      activeCharge: payload.billing.activeCharge,
    },
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  pending: false,
  billingPending: false,
  accountPending: false,
  session: null,
  license: readCachedLicenseState(),

  hydrate: async () => {
    if (get().pending || get().hydrated) return;
    await get().refreshStatus();
  },

  refreshStatus: async () => {
    set({ pending: true });

    try {
      const response = await apiClient.get<LicenseStatusPayload>("/api/license/status");
      const payload = normalizeLicensePayload(response.data);
      const previousUserId = await getLastAuthenticatedUserId();
      const nextUserId = payload.user?.id ?? null;

      if (payload.shouldWipeLocalData) {
        await wipeLocalWorkspace();
      } else if (previousUserId && nextUserId && previousUserId !== nextUserId) {
        await wipeLocalWorkspace();
      }

      useFlowStore.getState().syncUpdaterAccess(payload.releaseAccess.allowedChannels);

      persistLicenseState(payload);

      set({
        hydrated: true,
        pending: false,
        session: payload.user,
        license: payload,
      });

      return payload;
    } catch (error) {
      const isUnauthorized =
        error instanceof AxiosError && (error.response?.status === 401 || error.response?.status === 403);
      const fallbackPayload = createAnonymousLicenseState();

      if (isUnauthorized) {
        persistLicenseState(fallbackPayload);
      } else {
        console.error("Failed to refresh Flow Merge auth status", error);
      }

      useFlowStore.getState().syncUpdaterAccess(fallbackPayload.releaseAccess.allowedChannels);

      set({
        hydrated: true,
        pending: false,
        session: null,
        license: fallbackPayload,
      });

      return fallbackPayload;
    }
  },

  loginWithGoogle: async () => {
    set({ pending: true });

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: typeof window !== "undefined" ? window.location.href : "/",
        errorCallbackURL: typeof window !== "undefined" ? window.location.href : "/",
        disableRedirect: true,
      });

      const redirectUrl = result.data?.url;
      if (!redirectUrl) {
        set({ pending: false });
        return {
          success: false,
          error: "Nao foi possivel iniciar o login Google.",
        };
      }

      if (typeof window !== "undefined") {
        window.location.href = redirectUrl;
      }

      return { success: true };
    } catch (error) {
      console.error("Flow Merge Google sign-in failed", error);
      set({ pending: false });
      return {
        success: false,
        error: "Falha ao iniciar o login com Google.",
      };
    }
  },

  requestBillingCharge: async (planType) => {
    set({ billingPending: true });

    try {
      const response = await apiClient.post<{
        charge: LicenseStatusPayload["billing"]["activeCharge"];
      }>("/api/billing/charges", {
        planType,
      });

      const status = await get().refreshStatus();

      set({ billingPending: false });
      return {
        success: true,
        charge: response.data.charge ?? status.billing.activeCharge,
      };
    } catch (error) {
      console.error("Flow Merge billing charge request failed", error);
      set({ billingPending: false });
      return {
        success: false,
        error:
          error instanceof AxiosError
            ? (error.response?.data as { error?: string } | undefined)?.error ??
              "Nao foi possivel gerar o PIX agora."
            : "Nao foi possivel gerar o PIX agora.",
      };
    }
  },

  simulatePayment: async (planType) => {
    set({ accountPending: true });

    try {
      await apiClient.post("/api/billing/simulate", {
        planType,
      });
      await get().refreshStatus();
      set({ accountPending: false });
      return { success: true };
    } catch (error) {
      console.error("Flow Merge simulate payment failed", error);
      set({ accountPending: false });
      return {
        success: false,
        error:
          error instanceof AxiosError
            ? (error.response?.data as { error?: string } | undefined)?.error ??
              "Nao foi possivel simular o pagamento agora."
            : "Nao foi possivel simular o pagamento agora.",
      };
    }
  },

  cancelSubscription: async () => {
    set({ accountPending: true });

    try {
      await apiClient.post("/api/billing/cancel");
      await get().refreshStatus();
      set({ accountPending: false });
      return { success: true };
    } catch (error) {
      console.error("Flow Merge cancel subscription failed", error);
      set({ accountPending: false });
      return {
        success: false,
        error:
          error instanceof AxiosError
            ? (error.response?.data as { error?: string } | undefined)?.error ??
              "Nao foi possivel cancelar a conta agora."
            : "Nao foi possivel cancelar a conta agora.",
      };
    }
  },

  logout: async () => {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error("Flow Merge sign-out failed", error);
    }

    const anonymous = createAnonymousLicenseState();
    useFlowStore.getState().syncUpdaterAccess(anonymous.releaseAccess.allowedChannels);
    persistLicenseState(anonymous);

    set({
      hydrated: true,
      pending: false,
      billingPending: false,
      accountPending: false,
      session: null,
      license: anonymous,
    });
  },
}));
