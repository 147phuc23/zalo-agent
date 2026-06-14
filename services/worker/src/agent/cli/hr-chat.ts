import readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./args.js";
import { printScenarioResult } from "./print.js";
import {
  createHrChatSessionLogger,
  type HrChatSessionEndReason,
} from "./session-log.js";
import {
  parseMachineStdinLine,
  writeMachineEvent,
} from "./machine-io.js";
import { runHrAgentScenario } from "../core/runner.js";
import type { HrAgentRunResult, HrScenario, MockZaloPayload } from "../types.js";

const { envPath, repoRoot } = loadRepoEnv();

const argvSlice = process.argv.slice(2);
const args = parseCliArgs(argvSlice);
if (args.printDebugSteps) {
  process.env.DEBUG_OPENROUTER = "1";
}

const scenarioSlug = args.scenario ?? "interactive";
const sessionLogger = createHrChatSessionLogger({
  repoRoot,
  scenarioSlug,
  argv: argvSlice,
  consoleStream: args.machine ? "stderr" : "stdout",
});

if (isOpenRouterDebugEnabled()) {
  console.log("[hr-chat:debug]", {
    envFile: envPath,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL ?? "(unset; ai-client default https://openrouter.ai/api/v1)",
    OPENROUTER_API_KEY: maskSecret(process.env.OPENROUTER_API_KEY),
    HR_AGENT_MODEL: process.env.HR_AGENT_MODEL ?? "(unset)",
    resolvedCliModel: args.model,
    argv: argvSlice,
  });
}

console.log(`Session log: ${sessionLogger.logPath}`);
if (!args.machine) {
  console.log("HR agent interactive CLI. Type a message, or /exit.");
}

const stdinIsTTY = Boolean(process.stdin.isTTY);

const rl = readline.createInterface({
  input,
  output: args.machine ? process.stderr : output,
  crlfDelay: Infinity,
  terminal: stdinIsTTY,
});

if (!args.machine && stdinIsTTY) {
  rl.setPrompt("> ");
  rl.prompt();
}

if (args.machine) {
  writeMachineEvent({
    type: "session",
    machine: true,
    logPath: sessionLogger.logPath,
    model: args.model,
    argv: argvSlice,
    pid: process.pid,
  });
}

let sessionEnd: HrChatSessionEndReason = "exit";

if (stdinIsTTY) {
  rl.on("SIGINT", () => {
    sessionEnd = "interrupt";
    rl.close();
  });
} else {
  process.once("SIGINT", () => {
    sessionEnd = "interrupt";
    rl.close();
  });
}

process.once("SIGTERM", () => {
  sessionEnd = "interrupt";
  rl.close();
});

try {
  const tenantId = "22222222-2222-2222-2222-222222222222";
  const threadId = "interactive-zalo-thread";
  const externalUserId = "zalo-candidate-frontend";
  const messages: MockZaloPayload[] = [];

  let explicitExit = false;
  let pendingMessages: string[] = [];
  let debounceTimeout: NodeJS.Timeout | null = null;

  async function processPendingMessages() {
    if (pendingMessages.length === 0) return;

    const userText = pendingMessages.join("\n");
    pendingMessages = [];

    messages.push({
      id: `interactive-${messages.length + 1}`,
      tenantId,
      channel: "zalo",
      threadId,
      externalUserId,
      text: userText,
      receivedAt: new Date().toISOString(),
      raw: { source: "interactive-cli", content: userText },
    });

    const scenario: HrScenario = {
      id: "interactive",
      name: "Interactive HR chat",
      description: "Interactive mocked Zalo conversation.",
      tenantId,
      channel: "zalo",
      threadId,
      externalUserId,
      messages: [...messages],
    };

    const result = await runHrAgentScenario({
      scenario,
      model: args.model,
      useLocalCache: args.useLocalCache,
      forceProfileReload: args.forceProfileReload,
      printCache: args.printCache,
      mockLlm: args.mockLlm,
      skillMode: args.skillMode,
    });

    if (args.machine) {
      writeMachineEvent({
        type: "turn",
        scenario,
        result: serializeMachineTurn(result),
      });
      sessionLogger.logMachineTurnSnapshot({
        result,
        printCache: args.printCache,
        printDebugSteps: args.printDebugSteps,
      });
    } else {
      printScenarioResult({
        scenario,
        result,
        printCache: args.printCache,
        printDebugSteps: args.printDebugSteps,
        styledOutput: args.styledOutput,
      });
    }

    messages.push({
      id: `interactive-${messages.length + 1}`,
      tenantId,
      channel: "zalo",
      threadId,
      externalUserId: "agent",
      text: result.assistantText,
      receivedAt: new Date().toISOString(),
      raw: { source: "interactive-cli-assistant", content: result.assistantText },
    });

    if (!args.machine && stdinIsTTY) {
      rl.prompt();
    }
  }

  for await (const text of rl) {
    sessionLogger.logUserInput(text);

    const inbound = args.machine ? parseMachineStdinLine(text) : parseInteractiveLine(text);
    if (inbound.kind === "exit") {
      explicitExit = true;
      break;
    }
    if (inbound.kind === "skip") continue;

    pendingMessages.push(inbound.text);

    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      processPendingMessages().catch(console.error);
    }, 1000); // 1 second debounce
  }

  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  await processPendingMessages();

  if (!explicitExit && sessionEnd === "exit") {
    sessionEnd = "eof";
  }
} finally {
  if (args.machine) {
    try {
      writeMachineEvent({ type: "ended", reason: sessionEnd });
    } catch {
      // stdout may be closed
    }
  }
  sessionLogger.finalize(sessionEnd);
  try {
    rl.close();
  } catch {
    // readline may already be closed (e.g. Ctrl+C)
  }
}

function loadRepoEnv(): { repoRoot: string; envPath: string } {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../../../..");
  const envPath = path.join(repoRoot, ".env.local");
  dotenv.config({ path: envPath });
  return { repoRoot, envPath };
}

function isOpenRouterDebugEnabled() {
  const v = process.env.DEBUG_OPENROUTER ?? process.env.OPENROUTER_DEBUG;
  return v === "1" || v === "true";
}

function maskSecret(value: string | undefined) {
  if (!value) return "(unset)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function parseInteractiveLine(line: string):
  | { kind: "message"; text: string }
  | { kind: "exit" }
  | { kind: "skip" } {
  const trimmed = line.trim();
  if (trimmed === "/exit") return { kind: "exit" };
  if (!trimmed) return { kind: "skip" };
  return { kind: "message", text: line };
}

/** JSON-safe snapshot for external agents (avoid passing non-serializable provider blobs). */
function serializeMachineTurn(result: HrAgentRunResult) {
  return JSON.parse(JSON.stringify(result)) as HrAgentRunResult;
}
