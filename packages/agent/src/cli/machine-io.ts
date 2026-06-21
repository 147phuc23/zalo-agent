/**
 * Machine-readable stdin/stdout protocol for driving {@link hr-chat} from another process or agent.
 *
 * **stdout**: one JSON object per line (NDJSON). Human-oriented logs go to stderr (see `--machine`).
 *
 * **stdin**: one user turn per line:
 * - Plain text → user message (same as interactive CLI).
 * - `/exit` → end session.
 * - JSON: `{ "text": "..." }` or `{ "op": "exit" }`.
 */
export type MachineStdinMessage =
  | { kind: "message"; text: string }
  | { kind: "exit" }
  | { kind: "skip" };

export function parseMachineStdinLine(line: string): MachineStdinMessage {
  const trimmed = line.trim();
  if (trimmed === "/exit") return { kind: "exit" };
  if (!trimmed) return { kind: "skip" };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { text?: unknown; op?: unknown };
      if (parsed.op === "exit") return { kind: "exit" };
      if (typeof parsed.text === "string") return { kind: "message", text: parsed.text };
    } catch {
      return { kind: "message", text: line };
    }
  }

  return { kind: "message", text: line };
}

export function writeMachineEvent(event: unknown) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}
