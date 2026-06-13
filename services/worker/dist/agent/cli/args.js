export function parseCliArgs(argv) {
    const args = {
        model: process.env.HR_AGENT_MODEL ?? "cu/default",
        useLocalCache: true,
        forceProfileReload: false,
        printCache: false,
        printDebugSteps: false,
        styledOutput: true,
        mockLlm: false,
        twice: false,
        machine: false,
        skillMode: process.env.HR_SKILL_MODE === "twenty" ? "twenty" : "mock",
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--scenario")
            args.scenario = argv[++index];
        else if (arg === "--model")
            args.model = argv[++index] ?? args.model;
        else if (arg === "--no-local-cache")
            args.useLocalCache = false;
        else if (arg === "--force-profile-reload")
            args.forceProfileReload = true;
        else if (arg === "--print-cache")
            args.printCache = true;
        else if (arg === "--debug-steps")
            args.printDebugSteps = true;
        else if (arg === "--no-style")
            args.styledOutput = false;
        else if (arg === "--mock-llm")
            args.mockLlm = true;
        else if (arg === "--twice")
            args.twice = true;
        else if (arg === "--machine")
            args.machine = true;
        else if (arg === "--skill-mode") {
            const mode = argv[++index];
            if (mode === "twenty" || mode === "mock")
                args.skillMode = mode;
        }
    }
    return args;
}
