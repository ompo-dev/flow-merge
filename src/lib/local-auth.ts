import { z } from "zod";

export const AUTH_ACCOUNT_STORAGE_KEY = "flow-merge-local-account";
export const AUTH_SESSION_STORAGE_KEY = "flow-merge-local-session";

const PASSWORD_ITERATIONS = 210_000;
const SALT_SIZE = 16;
const encoder = new TextEncoder();

const storedAccountSchema = z.object({
  email: z.string().email(),
  passwordHash: z.string().min(32),
  salt: z.string().min(32),
  iterations: z.number().int().positive(),
  createdAt: z.number().int().positive(),
});

const storedSessionSchema = z.object({
  email: z.string().email(),
  createdAt: z.number().int().positive(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Use um email valido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export const registerSchema = loginSchema
  .extend({
    confirmPassword: z.string().min(1, "Confirme a senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas nao conferem.",
  });

export type StoredLocalAccount = z.infer<typeof storedAccountSchema>;
export type StoredLocalSession = z.infer<typeof storedSessionSchema>;

function getCryptoApi() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Crypto API indisponivel nesta sessao.");
  }

  return globalThis.crypto;
}

function bytesToHex(bytes: Uint8Array | ArrayBuffer) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (value) => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const chunks = hex.match(/.{1,2}/g) ?? [];
  return new Uint8Array(chunks.map((chunk) => Number.parseInt(chunk, 16)));
}

function readJsonStorage<T>(key: string, schema: z.ZodSchema<T>) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return schema.parse(parsed);
  } catch {
    return null;
  }
}

function writeJsonStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function clearStorageKey(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

async function hashPassword(password: string, salt: string, iterations = PASSWORD_ITERATIONS) {
  const cryptoApi = getCryptoApi();
  const keyMaterial = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hashBuffer = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return bytesToHex(hashBuffer);
}

function createRandomSalt() {
  const bytes = new Uint8Array(SALT_SIZE);
  getCryptoApi().getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function readStoredAccount() {
  return readJsonStorage(AUTH_ACCOUNT_STORAGE_KEY, storedAccountSchema);
}

export function readStoredSession() {
  return readJsonStorage(AUTH_SESSION_STORAGE_KEY, storedSessionSchema);
}

export function persistStoredAccount(account: StoredLocalAccount) {
  writeJsonStorage(AUTH_ACCOUNT_STORAGE_KEY, account);
}

export function persistStoredSession(session: StoredLocalSession) {
  writeJsonStorage(AUTH_SESSION_STORAGE_KEY, session);
}

export function clearStoredSession() {
  clearStorageKey(AUTH_SESSION_STORAGE_KEY);
}

export async function buildStoredAccount(email: string, password: string): Promise<StoredLocalAccount> {
  const normalizedEmail = normalizeEmail(email);
  const salt = createRandomSalt();
  const passwordHash = await hashPassword(password, salt, PASSWORD_ITERATIONS);

  return {
    email: normalizedEmail,
    salt,
    passwordHash,
    iterations: PASSWORD_ITERATIONS,
    createdAt: Date.now(),
  };
}

export async function verifyStoredPassword(account: StoredLocalAccount, password: string) {
  const passwordHash = await hashPassword(password, account.salt, account.iterations);
  return passwordHash === account.passwordHash;
}
