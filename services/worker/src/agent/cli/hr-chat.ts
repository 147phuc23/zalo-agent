import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./args.js";
import { printScenarioResult } from "./print.js";
import { runHrAgentScenario } from "../runtime/hr-agent.js";
import type { HrScenario, MockZaloPayload } from "../types.js";

const { envPath } = loadRepoEnv();

const args = parseCliArgs(process.argv.slice(2));
if (args.printDebugSteps) {
  process.env.DEBUG_OPENROUTER = "1";
}

if (isOpenRouterDebugEnabled()) {
  console.log("[hr-chat:debug]", {
    envFile: envPath,
    OPENROUTER_BASE_URL: process.env.OPENROUTER_BASE_URL ?? "(unset; ai-client default https://openrouter.ai/api/v1)",
    OPENROUTER_API_KEY: maskSecret(process.env.OPENROUTER_API_KEY),
    HR_AGENT_MODEL: process.env.HR_AGENT_MODEL ?? "(unset)",
    resolvedCliModel: args.model,
    argv: process.argv.slice(2),
  });
}

const rl = readline.createInterface({ input, output });

const tenantId = "22222222-2222-2222-2222-222222222222";
const threadId = "interactive-zalo-thread";
const externalUserId = "zalo-candidate-frontend";
const messages: MockZaloPayload[] = [];

console.log("HR agent interactive CLI. Type a message, or /exit.");

while (true) {
  const text = await rl.question("> ");
  if (text.trim() === "/exit") break;
  if (!text.trim()) continue;

  messages.push({
    id: `interactive-${messages.length + 1}`,
    tenantId,
    channel: "zalo",
    threadId,
    externalUserId,
    text,
    receivedAt: new Date().toISOString(),
    raw: { source: "interactive-cli", content: text },
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
  });

  printScenarioResult({
    scenario,
    result,
    printCache: args.printCache,
    printDebugSteps: args.printDebugSteps,
    styledOutput: args.styledOutput,
  });
}

rl.close();

function loadRepoEnv() {
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
