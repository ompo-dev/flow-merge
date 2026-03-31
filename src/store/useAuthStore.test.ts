import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LicenseStatusPayload } from "@/lib/license";

const {
  apiGetMock,
  apiPostMock,
  signInSocialMock,
  signOutMock,
  getSettingMock,
  setSettingMock,
  deleteSettingMock,
  resetLocalWorkspaceMock,
  syncUpdaterAccessMock,
} = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
  signInSocialMock: vi.fn(),
  signOutMock: vi.fn(),
  getSettingMock: vi.fn(),
  setSettingMock: vi.fn(),
  deleteSettingMock: vi.fn(),
  resetLocalWorkspaceMock: vi.fn(),
  syncUpdaterAccessMock: vi.fn(),
}));

vi.mock("@/lib/http-client", () => ({
  apiClient: {
    get: apiGetMock,
    post: apiPostMock,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: signInSocialMock,
    },
    signOut: signOutMock,
  },
}));

vi.mock("@/lib/storage/settings-store", () => ({
  getSetting: getSettingMock,
  setSetting: setSettingMock,
  deleteSetting: deleteSettingMock,
}));

vi.mock("@/store/useFlowStore", () => ({
  useFlowStore: {
    getState: () => ({
      resetLocalWorkspace: resetLocalWorkspaceMock,
      syncUpdaterAccess: syncUpdaterAccessMock,
    }),
  },
}));

function createStorageMock(initialValues: Record<string, string> = {}) {
  const store = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    dump: () => Object.fromEntries(store.entries()),
  };
}

function createLicensePayload(
  overrides: Partial<LicenseStatusPayload> = {},
): LicenseStatusPayload {
  return {
    authenticated: true,
    canAccessWorkspace: true,
    requiresPayment: false,
    shouldWipeLocalData: false,
    planType: "monthly",
    accessState: "active_monthly",
    user: {
      id: "user_1",
      name: "Maicon",
      email: "maicon@example.com",
      imageUrl: null,
    },
    timeline: {
      trialEndsAt: null,
      paymentDueAt: "2026-04-30T12:00:00.000Z",
      blockedAt: null,
      deleteAt: null,
    },
    releaseAccess: {
      level: "beta",
      allowedChannels: ["stable", "beta"],
    },
    billing: {
      planOptions: {
        monthly: {
          label: "Pro Mensal",
          amountInCents: 8_900,
        },
        lifetime: {
          label: "Founder Lifetime",
          amountInCents: 106_800,
        },
      },
      activeCharge: null,
    },
    ...overrides,
  };
}

async function loadStore(storageSeed: Record<string, string> = {}) {
  vi.resetModules();
  const localStorage = createStorageMock(storageSeed);
  const location = { href: "http://localhost:3000/" };
  getSettingMock.mockImplementation(async (key: string) => {
    if (key === "last-user-id") {
      return storageSeed["flow-merge-last-user-id"] ?? null;
    }
    return null;
  });
  setSettingMock.mockResolvedValue(undefined);
  deleteSettingMock.mockResolvedValue(undefined);

  vi.stubGlobal("window", {
    localStorage,
    location,
  });
  vi.stubGlobal("localStorage", localStorage);

  const module = await import("@/store/useAuthStore");
  return {
    useAuthStore: module.useAuthStore,
    localStorage,
    location,
  };
}

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshStatus aplica o payload, sincroniza canais e persiste a licenca", async () => {
    const payload = createLicensePayload();
    apiGetMock.mockResolvedValue({ data: payload });
    const { useAuthStore } = await loadStore();

    const result = await useAuthStore.getState().refreshStatus();

    expect(result).toEqual(payload);
    expect(syncUpdaterAccessMock).toHaveBeenCalledWith(["stable", "beta"]);
    expect(resetLocalWorkspaceMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session?.id).toBe("user_1");
    expect(setSettingMock).toHaveBeenCalledWith("license-cache", payload);
    expect(setSettingMock).toHaveBeenCalledWith("last-user-id", "user_1");
  });

  it("faz wipe local quando o backend manda shouldWipeLocalData", async () => {
    const payload = createLicensePayload({
      accessState: "deleted",
      shouldWipeLocalData: true,
    });
    apiGetMock.mockResolvedValue({ data: payload });
    const { useAuthStore } = await loadStore({
      "flow-merge-last-user-id": "user_1",
    });

    await useAuthStore.getState().refreshStatus();

    expect(resetLocalWorkspaceMock).toHaveBeenCalledTimes(1);
  });

  it("faz wipe local quando a conta autenticada muda entre refreshes", async () => {
    const payload = createLicensePayload({
      user: {
        id: "user_2",
        name: "Outro",
        email: "outro@example.com",
        imageUrl: null,
      },
    });
    apiGetMock.mockResolvedValue({ data: payload });
    const { useAuthStore } = await loadStore({
      "flow-merge-last-user-id": "user_1",
    });

    await useAuthStore.getState().refreshStatus();

    expect(resetLocalWorkspaceMock).toHaveBeenCalledTimes(1);
    expect(syncUpdaterAccessMock).toHaveBeenCalledWith(["stable", "beta"]);
  });

  it("cai para estado anonimo quando a licenca responde 401", async () => {
    const unauthorizedError = new AxiosError(
      "Unauthorized",
      "ERR_BAD_REQUEST",
      undefined,
      undefined,
      {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config: { headers: {} } as never,
        data: {},
      },
    );
    apiGetMock.mockRejectedValue(unauthorizedError);
    const { useAuthStore } = await loadStore({
      "flow-merge-license-cache": JSON.stringify(createLicensePayload()),
    });

    const result = await useAuthStore.getState().refreshStatus();

    expect(result.authenticated).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
    expect(syncUpdaterAccessMock).toHaveBeenCalledWith(["stable"]);
    expect(deleteSettingMock).toHaveBeenCalledWith("license-cache");
  });

  it("inicia o login Google e redireciona quando recebe a URL do Better Auth", async () => {
    signInSocialMock.mockResolvedValue({
      data: {
        url: "http://localhost:3000/api/auth/callback/google",
      },
    });
    const { useAuthStore, location } = await loadStore();

    const result = await useAuthStore.getState().loginWithGoogle();

    expect(result).toEqual({ success: true });
    expect(signInSocialMock).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "http://localhost:3000/",
      errorCallbackURL: "http://localhost:3000/",
      disableRedirect: true,
    });
    expect(location.href).toBe("http://localhost:3000/api/auth/callback/google");
  });

  it("falha com erro controlado quando o Better Auth nao devolve URL", async () => {
    signInSocialMock.mockResolvedValue({
      data: {},
    });
    const { useAuthStore } = await loadStore();

    const result = await useAuthStore.getState().loginWithGoogle();

    expect(result).toEqual({
      success: false,
      error: "Nao foi possivel iniciar o login Google.",
    });
    expect(useAuthStore.getState().pending).toBe(false);
  });

  it("faz logout, limpa a sessao cliente e ressincroniza os canais", async () => {
    signOutMock.mockResolvedValue({ success: true });
    const payload = createLicensePayload();
    const { useAuthStore } = await loadStore({
      "flow-merge-license-cache": JSON.stringify(payload),
      "flow-merge-last-user-id": "user_1",
    });

    useAuthStore.setState({
      hydrated: true,
      session: payload.user,
      license: payload,
    });

    await useAuthStore.getState().logout();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().session).toBeNull();
    expect(useAuthStore.getState().license.authenticated).toBe(false);
    expect(syncUpdaterAccessMock).toHaveBeenCalledWith(["stable"]);
    expect(deleteSettingMock).toHaveBeenCalledWith("license-cache");
  });
});
