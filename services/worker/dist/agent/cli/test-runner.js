import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runHrAgentScenario } from "../core/runner.js";
import { resetMockStore } from "../mock/store.js";
import { allTestCases } from "../verticals/hr/test-cases/index.js";
loadRepoEnv();
const args = parseArgs(process.argv.slice(2));
const model = process.env.HR_AGENT_MODEL ?? "cu/default";
const cases = args.caseId
    ? allTestCases.filter((tc) => tc.id === args.caseId)
    : allTestCases;
if (cases.length === 0) {
    console.error(`No test case found: "${args.caseId}"`);
    process.exit(1);
}
let passed = 0;
let failed = 0;
for (const testCase of cases) {
    resetMockStore();
    let lastResult = null;
    const messages = [];
    const tenantId = "test-tenant";
    const threadId = `test-${testCase.id}`;
    const externalUserId = `test-user-${testCase.id}`;
    for (const turn of testCase.turns) {
        messages.push({
            id: `${threadId}-msg-${messages.length}`,
            tenantId,
            channel: "zalo",
            threadId,
            externalUserId,
            text: turn.content,
            receivedAt: new Date().toISOString(),
            raw: { source: "test-runner" },
        });
        const scenario = {
            id: testCase.id,
            name: testCase.description,
            description: testCase.description,
            tenantId,
            channel: "zalo",
            threadId,
            externalUserId,
            messages: [...messages],
        };
        lastResult = await runHrAgentScenario({
            scenario,
            model,
            useLocalCache: true,
            forceProfileReload: false,
            printCache: false,
            mockLlm: false,
            skillMode: "mock",
        });
        messages.push({
            id: `${threadId}-msg-${messages.length}`,
            tenantId,
            channel: "zalo",
            threadId,
            externalUserId: "agent",
            text: lastResult.assistantText,
            receivedAt: new Date().toISOString(),
            raw: { source: "test-runner-assistant" },
        });
    }
    if (!lastResult)
        continue;
    const failures = checkAssertions(testCase.assertions, lastResult);
    if (failures.length === 0) {
        console.log(`PASS  ${testCase.id} — ${testCase.description}`);
        passed++;
    }
    else {
        console.log(`FAIL  ${testCase.id} — ${testCase.description}`);
        for (const f of failures)
            console.log(`      ${f}`);
        if (args.verbose) {
            console.log(`      response: "${lastResult.assistantText}"`);
        }
        failed++;
    }
}
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0)
    process.exit(1);
function checkAssertions(assertions, result) {
    const failures = [];
    const response = result.assistantText.toLowerCase();
    const calledToolNames = new Set(result.steps.flatMap((step) => (step.toolCalls ?? [])
        .map((c) => c.toolName)
        .filter(Boolean)));
    for (const assertion of assertions) {
        switch (assertion.type) {
            case "response-contains":
                if (!response.includes(assertion.value.toLowerCase()))
                    failures.push(`expected response to contain "${assertion.value}"`);
                break;
            case "response-not-contains":
                if (response.includes(assertion.value.toLowerCase()))
                    failures.push(`expected response NOT to contain "${assertion.value}"`);
                break;
            case "skill-called":
                if (!calledToolNames.has(assertion.skillId))
                    failures.push(`expected skill "${assertion.skillId}" to be called`);
                break;
            case "skill-not-called":
                if (calledToolNames.has(assertion.skillId))
                    failures.push(`expected skill "${assertion.skillId}" NOT to be called`);
                break;
        }
    }
    return failures;
}
function parseArgs(argv) {
    const args = { caseId: undefined, verbose: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--case")
            args.caseId = argv[++i];
        else if (argv[i] === "--verbose")
            args.verbose = true;
    }
    return args;
}
function loadRepoEnv() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const repoRoot = path.resolve(__dirname, "../../../../..");
    dotenv.config({ path: path.join(repoRoot, ".env.local") });
}
