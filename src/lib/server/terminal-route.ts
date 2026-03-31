import "server-only";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";

const terminalShellSchema = z.enum(["cmd", "powershell", "bash", "zsh"]);
const terminalSignalSchema = z.enum(["SIGINT", "EOF", "KILL"]);

export const terminalOpenSessionSchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
  shell: terminalShellSchema.optional(),
  workingDirectory: z.string().trim().min(1).optional(),
  cols: z.number().int().min(1).max(400).optional(),
  rows: z.number().int().min(1).max(200).optional(),
  initialOutput: z.string().optional(),
});

export const terminalInputSchema = z.object({
  data: z.string(),
});

export const terminalResizeSchema = z.object({
  cols: z.number().int().min(1).max(400),
  rows: z.number().int().min(1).max(200),
});

export const terminalSignalBodySchema = z.object({
  signal: terminalSignalSchema,
});

export async function requireTerminalSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return Response.json(
      { error: "Sessao invalida." },
      { status: 401 },
    );
  }

  return null;
}

export function terminalJsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function parseTerminalBody<T>(
  request: Request,
  schema: z.ZodSchema<T>,
): Promise<{ data: T } | { response: Response }> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return {
      response: terminalJsonError("Payload invalido.", 400),
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      response: terminalJsonError(
        parsed.error.issues[0]?.message ?? "Payload invalido.",
        400,
      ),
    };
  }

  return { data: parsed.data };
}
