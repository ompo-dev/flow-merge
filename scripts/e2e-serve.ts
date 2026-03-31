import { spawn } from "node:child_process";

const E2E_PORT = process.env.PORT?.trim() || "3001";
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
const BUN_EXECUTABLE = process.execPath;

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"}`));
    });
  });
}

async function main() {
  const env = {
    ...process.env,
    PORT: E2E_PORT,
    BETTER_AUTH_URL: E2E_BASE_URL,
    NEXT_PUBLIC_FLOW_MERGE_API_BASE_URL: E2E_BASE_URL,
  };

  await runCommand(BUN_EXECUTABLE, ["run", "build"], env);

  const server = spawn(
    BUN_EXECUTABLE,
    ["x", "next", "start", "--port", E2E_PORT, "--hostname", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    },
  );

  const shutdown = (signal: NodeJS.Signals) => {
    if (server.killed) return;
    server.kill(signal);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  server.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  server.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

await main();
