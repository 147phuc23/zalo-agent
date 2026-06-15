const CORE_HR_AGENT_INSTRUCTIONS = [
    "# HR Chat Agent Responsibility",
    "You are an HR recruiter chat agent for Zalo conversations.",
    "Reply in Vietnamese unless the candidate writes in English.",
    "Your job is to gather candidate requirements, avoid asking for known CRM details, search matching jobs when enough information exists, and save interaction state/history through skills.",
    "CRITICAL: The chat history is strictly truncated to the last 30 messages. If the candidate shares ANY job requirements (role, experience, salary, location), you MUST immediately call the `hr_gatherRequirement` tool to save it into the Conversation State. If you do not save it, you will forget it and ask again.",
    "Always use skills for CRM/profile lookup, requirement updates, job search, memory, and history when relevant.",
    "Use CRM profile write skills when the candidate shares durable profile facts or recruiter notes.",
    "Ask at most one focused follow-up question when important requirement fields are missing.",
    "Strictly follow a message-by-message response style like a human chatting on a messaging app.",
    "Keep each message extremely short, natural, and concise (ideally 1-2 short sentences per message bubble).",
    "Break your thoughts into sequential, realistic chat replies separated by double newlines (\n\n), instead of combining everything into a single long paragraph.",
    "Add appropriate friendly icons/emojis (e.g., 😊, 👍, ✨) to make the chat engaging and friendly.",
    "Do not write one very long paragraph; instead, use double newlines (\n\n) to separate the response into a list of concise chat replies.",
    "When listing or recommending jobs, do NOT use markdown bold formatting (like **Job Title**). Use plain text.",
    "Do NOT use numbered list emojis (like 1️⃣, 2️⃣) or shopping/cart emojis (like 🛒) when presenting jobs. Write in a natural, human-like conversational style.",
    "IMPORTANT: The most recent unread messages from the candidate are located at the very bottom of the Conversation State history. Process them carefully and respond.",
    "CRITICAL: DO NOT reveal the exact salary range or limits of any job to the candidate under any circumstances. If they ask, state that it is competitive and matches their expectations."
].join("\n");
export function buildPromptCacheContext(input) {
    const stablePrefix = [
        CORE_HR_AGENT_INSTRUCTIONS,
        input.skillCache.defaultSkillsPromptBlock,
    ].join("\n\n");
    const dynamicContext = [
        buildLoadedSkillsBlock(input.loadedSkills),
        "# Customer Profile Snapshot",
        formatProfile(input.customerProfile),
        "# Conversation State",
        formatState(input.state),
        "# Required Agent Output",
        "Use tools as needed. Then produce the next concise recruiter reply for the candidate.",
    ].join("\n\n");
    return {
        stablePrefix,
        system: stablePrefix,
        prompt: dynamicContext,
        diagnostics: buildDiagnostics({
            coreInstructions: CORE_HR_AGENT_INSTRUCTIONS,
            skillIndex: input.skillCache.defaultSkillsPromptBlock,
            loadedSkills: buildLoadedSkillsBlock(input.loadedSkills),
            dynamicContext,
        }),
    };
}
function buildLoadedSkillsBlock(skills) {
    if (skills.length === 0) {
        return "# Loaded Skills\nNo additional non-default skills are loaded.";
    }
    return [
        "# Loaded Skills",
        ...skills.map((skill) => `## ${skill.id}: ${skill.name}\n${skill.content}`),
    ].join("\n\n");
}
function formatProfile(profile) {
    const lines = [];
    for (const [key, value] of Object.entries(profile)) {
        if (value === null || value === undefined || value === "")
            continue;
        if (Array.isArray(value) && value.length === 0)
            continue;
        lines.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
    return lines.length > 0 ? lines.join("\n") : "No profile data available.";
}
function formatState(state) {
    const lines = [
        `- tenantId: ${state.tenantId}`,
        `- channel: ${state.channel}`,
        `- threadId: ${state.threadId}`,
        `- externalUserId: ${state.externalUserId}`,
        `- version: ${state.version}`,
        `- intent: ${state.intent || "null"}`,
        `- requirement: ${Object.keys(state.requirement).length > 0 ? JSON.stringify(state.requirement) : "{}"}`,
        `- loadedSkills: ${state.loadedSkills.length > 0 ? state.loadedSkills.join(", ") : "[]"}`,
        "",
        "## Chat History (Last 30 messages):"
    ];
    const recentHistory = state.history.slice(-30);
    if (recentHistory.length === 0) {
        lines.push("(Empty)");
    }
    else {
        for (const msg of recentHistory) {
            lines.push(`[${msg.role.toUpperCase()}]: ${msg.content}`);
        }
    }
    return lines.join("\n");
}
function buildDiagnostics(input) {
    const sections = [
        sectionDiagnostics("coreInstructions", "system", true, input.coreInstructions),
        sectionDiagnostics("skillIndex", "system", true, input.skillIndex),
        sectionDiagnostics("loadedSkills", "user", false, input.loadedSkills),
        sectionDiagnostics("dynamicConversationContext", "user", false, input.dynamicContext),
    ];
    const totalChars = sections.reduce((sum, section) => sum + section.chars, 0);
    return {
        sections,
        totalChars,
        estimatedTotalTokens: estimateTokens(totalChars),
    };
}
function sectionDiagnostics(name, placement, cacheCandidate, content) {
    return {
        name,
        placement,
        cacheCandidate,
        chars: content.length,
        estimatedTokens: estimateTokens(content.length),
    };
}
function estimateTokens(chars) {
    return Math.ceil(chars / 4);
}
