import { spawn } from "node-pty";

let processHandle = null;
let stdinBuffer = "";

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function readChunk(encoded) {
  return Buffer.from(encoded, "base64").toString("utf8");
}

function writeData(encoded) {
  if (!processHandle) return;
  processHandle.write(readChunk(encoded));
}

function resize(cols, rows) {
  if (!processHandle) return;
  processHandle.resize(cols, rows);
}

function kill() {
  if (!processHandle) return;
  processHandle.kill();
}

function handleInit(message) {
  try {
    processHandle = spawn(message.command, message.args ?? [], {
      name: "xterm-256color",
      cols: message.cols ?? 120,
      rows: message.rows ?? 30,
      cwd: message.cwd,
      env: message.env ?? process.env,
    });

    processHandle.onData((chunk) => {
      send({
        type: "data",
        chunk: Buffer.from(chunk, "utf8").toString("base64"),
      });
    });

    processHandle.onExit((event) => {
      send({
        type: "exit",
        exitCode: event.exitCode ?? null,
        signal: event.signal ?? null,
      });
      setTimeout(() => process.exit(typeof event.exitCode === "number" ? event.exitCode : 0), 0);
    });

    send({ type: "ready" });
  } catch (error) {
    send({
      type: "error",
      message: error instanceof Error ? error.message : "Falha ao iniciar o host PTY.",
    });
    process.exit(1);
  }
}

function handleMessage(line) {
  if (!line.trim()) return;

  const message = JSON.parse(line);

  switch (message.type) {
    case "init":
      handleInit(message);
      break;
    case "input":
      writeData(message.data);
      break;
    case "resize":
      resize(message.cols, message.rows);
      break;
    case "kill":
      kill();
      break;
    default:
      break;
  }
}

process.stdin.setEncoding("utf8");
process.stdin.resume();
process.stdin.on("data", (chunk) => {
  stdinBuffer += chunk;

  while (true) {
    const newlineIndex = stdinBuffer.indexOf("\n");
    if (newlineIndex === -1) break;

    const line = stdinBuffer.slice(0, newlineIndex);
    stdinBuffer = stdinBuffer.slice(newlineIndex + 1);
    handleMessage(line);
  }
});

process.on("SIGTERM", () => {
  kill();
  process.exit(0);
});
