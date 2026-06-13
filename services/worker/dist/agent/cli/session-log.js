import fs from "node:fs";
import path from "node:path";
import util from "node:util";
// Strip SGR sequences for readable log files (eslint disallows ESC in regex literals).
const ANSI_ESCAPE = new RegExp(`${"\u001B"}\\[[\\d;]*m`, "g");
/** Plain logs under repo `logs/hr-chat/{scenario}_{timestamp}.log` with ANSI stripped. */
export function createHrChatSessionLogger(options) {
    const timestamp = formatLogTimestamp(new Date());
    const safeScenario = sanitizeScenarioSlug(options.scenarioSlug);
    const logsDir = path.join(options.repoRoot, "logs", "hr-chat");
    fs.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, `${safeScenario}_${timestamp}.log`);
    let finalized = false;
    const consoleStream = options.consoleStream ?? "stdout";
    const originals = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console),
    };
    function append(level, formatted) {
        if (finalized)
            return;
        const plain = stripAnsi(formatted);
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${level} ${plain}\n`, "utf8");
    }
    function emitLogLike(formatted) {
        if (consoleStream === "stderr") {
            process.stderr.write(`${formatted}\n`);
        }
        else {
            process.stdout.write(`${formatted}\n`);
        }
    }
    function patchConsole() {
        console.log = (...args) => {
            const formatted = util.format(...args);
            emitLogLike(formatted);
            append("LOG", formatted);
        };
        console.info = (...args) => {
            const formatted = util.format(...args);
            emitLogLike(formatted);
            append("INFO", formatted);
        };
        console.warn = (...args) => {
            originals.warn(...args);
            append("WARN", util.format(...args));
        };
        console.error = (...args) => {
            originals.error(...args);
            append("ERROR", util.format(...args));
        };
        console.debug = (...args) => {
            const formatted = util.format(...args);
            emitLogLike(formatted);
            append("DEBUG", formatted);
        };
    }
    function writeHeader() {
        const header = `--- HR chat session ---\n` +
            `scenario: ${options.scenarioSlug}\n` +
            `argv: ${JSON.stringify(options.argv)}\n` +
            `startedAt: ${new Date().toISOString()}\n` +
            `---\n`;
        fs.appendFileSync(logPath, header, "utf8");
    }
    writeHeader();
    patchConsole();
    return {
        logPath,
        logUserInput(line) {
            if (finalized)
                return;
            fs.appendFileSync(logPath, `[${new Date().toISOString()}] USER ${line}\n`, "utf8");
        },
        logMachineTurnSnapshot(input) {
            if (finalized)
                return;
            const ts = new Date().toISOString();
            const plainAssistant = stripAnsi(input.result.assistantText);
            const assistantLines = plainAssistant.split("\n");
            for (let index = 0; index < assistantLines.length; index += 1) {
                const prefix = index === 0 ? "ASSISTANT " : "          ";
                fs.appendFileSync(logPath, `[${ts}] ${prefix}${assistantLines[index]}\n`, "utf8");
            }
            fs.appendFileSync(logPath, `[${ts}] STATE ${JSON.stringify({
                intent: input.result.state.intent ?? null,
                requirement: input.result.state.requirement,
                historyCount: input.result.state.history.length,
            })}\n`, "utf8");
            if (input.printDebugSteps && input.result.steps.length > 0) {
                fs.appendFileSync(logPath, `[${ts}] STEPS ${JSON.stringify(input.result.steps)}\n`, "utf8");
            }
            if (input.printCache) {
                fs.appendFileSync(logPath, `[${ts}] CACHE ${JSON.stringify(input.result.cache)}\n`, "utf8");
            }
            else {
                const hash = input.result.cache.skillPromptHash;
                fs.appendFileSync(logPath, `[${ts}] CACHE skillCache=${input.result.cache.skillCache} profileCache=${input.result.cache.profileCache} skillPromptHash=${hash.slice(0, 12)}\n`, "utf8");
            }
        },
        finalize(reason) {
            if (finalized)
                return;
            finalized = true;
            console.log = originals.log;
            console.info = originals.info;
            console.warn = originals.warn;
            console.error = originals.error;
            console.debug = originals.debug;
            try {
                fs.appendFileSync(logPath, `--- session end: ${reason} at ${new Date().toISOString()} ---\n`, "utf8");
            }
            catch {
                // best-effort
            }
        },
    };
}
function stripAnsi(text) {
    return text.replace(ANSI_ESCAPE, "");
}
function sanitizeScenarioSlug(raw) {
    const trimmed = raw.trim() || "interactive";
    const safe = trimmed.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
    return safe.slice(0, 120) || "interactive";
}
/** Filesystem-safe timestamp (sortable). */
function formatLogTimestamp(date) {
    return date.toISOString().replace(/[:.]/g, "-");
}
