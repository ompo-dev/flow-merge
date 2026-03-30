"use client";

import { create } from "zustand";
import {
  buildStoredAccount,
  clearStoredSession,
  loginSchema,
  normalizeEmail,
  persistStoredAccount,
  persistStoredSession,
  readStoredAccount,
  readStoredSession,
  registerSchema,
  type StoredLocalAccount,
  type StoredLocalSession,
  verifyStoredPassword,
} from "@/lib/local-auth";

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthState {
  hydrated: boolean;
  account: StoredLocalAccount | null;
  session: StoredLocalSession | null;
  hydrate: () => void;
  register: (input: {
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<AuthResult>;
  login: (input: { email: string; password: string }) => Promise<AuthResult>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  account: null,
  session: null,

  hydrate: () => {
    if (get().hydrated) return;

    const account = readStoredAccount();
    const session = readStoredSession();
    const safeSession = account && session && session.email === account.email ? session : null;

    if (session && !safeSession) {
      clearStoredSession();
    }

    set({
      hydrated: true,
      account,
      session: safeSession,
    });
  },

  register: async (input) => {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Revise os dados de acesso.",
      };
    }

    if (get().account) {
      return {
        success: false,
        error: "Ja existe um acesso local configurado nesta maquina.",
      };
    }

    try {
      const account = await buildStoredAccount(parsed.data.email, parsed.data.password);
      const session: StoredLocalSession = {
        email: account.email,
        createdAt: Date.now(),
      };

      persistStoredAccount(account);
      persistStoredSession(session);

      set({
        hydrated: true,
        account,
        session,
      });

      return { success: true };
    } catch (error) {
      console.error("Local auth register failed", error);
      return {
        success: false,
        error: "Nao foi possivel criar o acesso local agora.",
      };
    }
  },

  login: async (input) => {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Revise email e senha.",
      };
    }

    const account = get().account ?? readStoredAccount();
    if (!account) {
      return {
        success: false,
        error: "Nenhum acesso local configurado ainda.",
      };
    }

    try {
      const normalizedEmail = normalizeEmail(parsed.data.email);
      const isEmailValid = normalizedEmail === account.email;
      const isPasswordValid = isEmailValid
        ? await verifyStoredPassword(account, parsed.data.password)
        : false;

      if (!isEmailValid || !isPasswordValid) {
        return {
          success: false,
          error: "Email ou senha invalidos.",
        };
      }

      const session: StoredLocalSession = {
        email: account.email,
        createdAt: Date.now(),
      };

      persistStoredSession(session);
      set({
        hydrated: true,
        account,
        session,
      });

      return { success: true };
    } catch (error) {
      console.error("Local auth login failed", error);
      return {
        success: false,
        error: "Nao foi possivel validar o acesso local agora.",
      };
    }
  },

  logout: () => {
    clearStoredSession();
    set({ session: null });
  },
}));
