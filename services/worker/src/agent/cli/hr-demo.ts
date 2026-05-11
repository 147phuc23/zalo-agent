import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./args.js";
import { printScenarioResult } from "./print.js";
import { runHrAgentScenario } from "../runtime/hr-agent.js";
import { findScenario, hrScenarios } from "../scenarios/hr-scenarios.js";

loadRepoEnv();

const args = parseCliArgs(process.argv.slice(2));
if (args.printDebugSteps) {
  process.env.DEBUG_OPENROUTER = "1";
}

const selected = args.scenario ? [findScenario(args.scenario)] : hrScenarios;
const scenarios = selected.filter(Boolean);

if (scenarios.length === 0) {
  throw new Error(`No scenario found for ${args.scenario}`);
}

const runs = args.twice ? [1, 2] : [1];

for (const runNumber of runs) {
  if (args.twice) console.log(`\n######## RUN ${runNumber} ########`);

  for (const scenario of scenarios) {
    const result = await runHrAgentScenario({
      scenario: scenario!,
      model: args.model,
      useLocalCache: args.useLocalCache,
      forceProfileReload: args.forceProfileReload,
      printCache: args.printCache,
      mockLlm: args.mockLlm,
    });

    printScenarioResult({
      scenario: scenario!,
      result,
      printCache: args.printCache,
      printDebugSteps: args.printDebugSteps,
      styledOutput: args.styledOutput,
    });
  }
}

function loadRepoEnv() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../../../../..");
  dotenv.config({ path: path.join(repoRoot, ".env.local") });
}
