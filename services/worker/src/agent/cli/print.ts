import type { HrAgentRunResult, HrScenario } from "../types.js";

export function printScenarioResult(input: {
  scenario: HrScenario;
  result: HrAgentRunResult;
  printCache: boolean;
  printDebugSteps: boolean;
  styledOutput: boolean;
}) {
  console.log(`\n=== ${input.scenario.id}: ${input.scenario.name} ===`);
  console.log(input.scenario.description);
  console.log("\nInbound Zalo messages:");
  for (const message of input.scenario.messages) {
    printInboundMessage(message.externalUserId, message.text, input.styledOutput);
  }

  console.log("\nSystem:");
  const parts = input.result.assistantText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    printSystemResponse(part, input.styledOutput);
  }

  if (input.printDebugSteps) {
    console.log("\nTool steps:");
    for (const [index, step] of input.result.steps.entries()) {
      printDebugStep(index + 1, step, input.styledOutput);
    }
  }

  console.log("\nFinal state:");
  console.log(JSON.stringify({
    intent: input.result.state.intent ?? null,
    requirement: input.result.state.requirement,
    historyCount: input.result.state.history.length,
  }, null, 2));

  if (input.printCache) {
    console.log("\nCache:");
    console.log(JSON.stringify(input.result.cache, null, 2));
  } else {
    console.log(
      `\nCache: skillCache=${input.result.cache.skillCache} profileCache=${input.result.cache.profileCache} skillPromptHash=${input.result.cache.skillPromptHash.slice(0, 12)}`,
    );
  }
}

const ansi = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  italic: "\u001B[3m",
  fgMuted: "\u001B[38;5;245m",
  fgSystem: "\u001B[38;5;15m",
  fgDebug: "\u001B[38;5;153m",
  fgUser: "\u001B[38;5;231m",
  bgSystem: "\u001B[48;5;24m",
  bgDebug: "\u001B[48;5;236m",
  bgUser: "\u001B[48;5;238m",
};

type DebugStep = HrAgentRunResult["steps"][number];

function printInboundMessage(externalUserId: string, text: string, styledOutput: boolean) {
  if (!styledOutput) {
    console.log(`- ${externalUserId}: ${text}`);
    return;
  }

  const label = `${externalUserId}: `;
  console.log(`${ansi.bgUser}${ansi.fgUser}${ansi.bold} ${label}${ansi.reset}${ansi.bgUser}${ansi.fgUser}${text} ${ansi.reset}`);
}

function printSystemResponse(text: string, styledOutput: boolean) {
  if (!styledOutput) {
    console.log(text);
    return;
  }

  const width = terminalWidth();
  const blockWidth = Math.min(76, Math.max(36, width - 8));
  const lines = wrapText(text, blockWidth - 4);

  for (const line of lines) {
    const content = `  ${line.padEnd(blockWidth - 4)}  `;
    console.log(`${" ".repeat(Math.max(0, width - blockWidth))}${ansi.bgSystem}${ansi.fgSystem}${ansi.italic}${content}${ansi.reset}`);
  }
}

function printDebugStep(index: number, step: DebugStep, styledOutput: boolean) {
  const lines = [
    `step ${index}: text=${JSON.stringify(step.text ?? "")}`,
    ...debugJsonLines("toolCalls", step.toolCalls),
    ...debugJsonLines("toolResults", step.toolResults),
  ];

  if (!styledOutput) {
    for (const line of lines) console.log(`- ${line}`);
    return;
  }

  for (const line of lines) {
    console.log(`${ansi.bgDebug}${ansi.fgDebug}${ansi.dim}${ansi.italic} ${line} ${ansi.reset}`);
  }
}

function debugJsonLines(label: string, value: unknown[] | undefined): string[] {
  if (!value?.length) return [];

  const json = JSON.stringify(value, null, 2).split("\n");
  return [`${label}=`, ...json.map((line) => `  ${line}`)];
}

function terminalWidth() {
  return Math.max(40, process.stdout.columns ?? 100);
}

function wrapText(text: string, width: number) {
  const lines: string[] = [];

  for (const sourceLine of text.split("\n")) {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    let current = "";

    for (const word of words) {
      if (word.length > width) {
        if (current) lines.push(current);
        lines.push(...chunkWord(word, width));
        current = "";
      } else if (!current) {
        current = word;
      } else if (current.length + word.length + 1 <= width) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }

    lines.push(current);
  }

  return lines.length ? lines : [""];
}

function chunkWord(word: string, width: number) {
  const chunks: string[] = [];
  for (let index = 0; index < word.length; index += width) {
    chunks.push(word.slice(index, index + width));
  }
  return chunks;
}
