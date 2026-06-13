const CORE_HR_AGENT_INSTRUCTIONS = [
    "# HR Chat Agent Responsibility",
    "You are an HR recruiter chat agent for Zalo conversations.",
    "Reply in Vietnamese unless the candidate writes in English.",
    "Your job is to gather candidate requirements, avoid asking for known CRM details, search matching jobs when enough information exists, and save interaction state/history through skills.",
    "Always use skills for CRM/profile lookup, requirement updates, job search, memory, and history when relevant.",
    "Use CRM profile write skills when the candidate shares durable profile facts or recruiter notes. Use requirement skills for temporary job-search criteria.",
    "Ask at most one focused follow-up question when important requirement fields are missing.",
    "Strictly follow a message-by-message response style like a human chatting on a messaging app.",
    "Keep each message extremely short, natural, and concise (ideally 1-2 short sentences per message bubble).",
    "Break your thoughts into sequential, realistic chat replies separated by double newlines (\n\n), instead of combining everything into a single long paragraph.",
    "Add appropriate friendly icons/emojis (e.g., 😊, 👍, ✨) to make the chat engaging and friendly.",
    "Do not write one very long paragraph; instead, use double newlines (\n\n) to separate the response into a list of concise chat replies.",
].join("\n");
export function buildPromptCacheContext(input) {
    const stablePrefix = [
        CORE_HR_AGENT_INSTRUCTIONS,
        input.skillCache.defaultSkillsPromptBlock,
    ].join("\n\n");
    const newMessages = getNewMessages(input.latestMessages, input.state.history);
    const dynamicContext = [
        buildLoadedSkillsBlock(input.loadedSkills),
        "# Customer Profile Snapshot",
        jsonBlock(input.customerProfile),
        "# Conversation State",
        jsonBlock({
            tenantId: input.state.tenantId,
            channel: input.state.channel,
            threadId: input.state.threadId,
            externalUserId: input.state.externalUserId,
            version: input.state.version,
            intent: input.state.intent ?? null,
            requirement: input.state.requirement,
            loadedSkills: input.state.loadedSkills,
            history: input.state.history.slice(-8).map((entry) => ({
                role: entry.role,
                content: entry.content,
                createdAt: entry.createdAt,
            })),
        }),
        "# Latest Zalo Messages",
        jsonBlock(newMessages.map((message) => ({
            id: message.id,
            text: message.text,
            receivedAt: message.receivedAt,
        }))),
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
function jsonBlock(value) {
    return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
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
function getNewMessages(messages, history) {
    if (messages.length === 0)
        return [];
    const assistantMessages = history.filter((h) => h.role === "assistant");
    if (assistantMessages.length === 0) {
        return [messages[messages.length - 1]];
    }
    const lastAssistantTime = new Date(assistantMessages[assistantMessages.length - 1].createdAt).getTime();
    const newMsgs = messages.filter((m) => {
        const receivedTime = new Date(m.receivedAt).getTime();
        return receivedTime > lastAssistantTime;
    });
    return newMsgs.length > 0 ? newMsgs : [messages[messages.length - 1]];
}
