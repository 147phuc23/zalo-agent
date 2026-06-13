export function parseMachineStdinLine(line) {
    const trimmed = line.trim();
    if (trimmed === "/exit")
        return { kind: "exit" };
    if (!trimmed)
        return { kind: "skip" };
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed.op === "exit")
                return { kind: "exit" };
            if (typeof parsed.text === "string")
                return { kind: "message", text: parsed.text };
        }
        catch {
            return { kind: "message", text: line };
        }
    }
    return { kind: "message", text: line };
}
export function writeMachineEvent(event) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
}
