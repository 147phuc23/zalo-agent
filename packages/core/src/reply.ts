import type { createRepositorySet, MessageRow } from "@platform/database";
import {
  runHrAgentScenario,
  classifyIntent,
  generateChitchatReply,
  resolveHrSkillMode,
} from "@platform/agent";
import type { MockZaloPayload } from "@platform/agent";
import { createOpenRouterChatModel } from "@platform/ai-client";
import { generateText } from "ai";
import { z } from "zod";
import { buildKnownFacts } from "./known-facts.js";

type Repos = ReturnType<typeof createRepositorySet>;

const DraftResponsesSchema = z.union([
  z.object({
    responses: z.array(z.string().trim().min(1)).min(1),
  }),
  z.array(z.string().trim().min(1)).min(1),
]);

export async function generateAndSaveReply(
  repos: Repos,
  input: {
    tenantId: string;
    conversationId: string;
    targetMessageId?: string;
  },
): Promise<MessageRow[]> {
  const messages = await repos.messages.listByConversation({
    conversationId: input.conversationId,
    limit: 100,
  });
  const conversation = await repos.conversations.findById(input.conversationId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${input.conversationId}`);
  }

  const contactList = await repos.contacts.listByIds({ ids: [conversation.contact_id] });
  const contact = contactList[0];
  const contactName = contact?.display_name ?? "Khách hàng";
  const externalUserId = contact?.external_user_id ?? "unknown";

  const overrideModel = conversation.override_model;
  const defaultModel =
    (await resolveDefaultModel(repos, input.tenantId)) ?? "tencent/hy3:free";
  const model = overrideModel || defaultModel;

  const classifierModel =
    (await resolveClassifierModel(repos, input.tenantId)) ?? "tencent/hy3:free";
  const routerMessages = messages.map((m) => ({
    role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
    content: m.text ?? "",
  }));

  let targetMessage: MessageRow | undefined;
  if (input.targetMessageId) {
    targetMessage = messages.find((m) => m.id === input.targetMessageId);
  }

  const knownFactsResult = await buildKnownFacts(repos, input.conversationId);

  const classification = await classifyIntent(
    routerMessages,
    classifierModel,
    knownFactsResult?.text,
    knownFactsResult?.requirement,
  );
  console.log(
    `[core:reply] classification result for conversation ${input.conversationId}: ${classification.category} (reason: ${classification.reason})`,
  );

  if (classification.normalizedRequirement && Object.keys(classification.normalizedRequirement).length > 0) {
    await repos.audits.append({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      toolName: "requirement_normalizer",
      outputPayload: { requirement: classification.normalizedRequirement },
      status: "ok",
    });
  }

  if (classification.category === "CHITCHAT") {
    const chitchatText = await generateChitchatReply(
      routerMessages,
      classifierModel,
      knownFactsResult?.text,
    );
    const responses = parseDraftResponses(chitchatText);
    const batchId = `draft:${input.tenantId}:${input.conversationId}:${Date.now()}`;
    const savedMessages: MessageRow[] = [];

    for (const [index, response] of responses.entries()) {
      const idempotencyKey = `${batchId}:${index + 1}`;
      const msgRow = await repos.messages.createOutbound({
        tenantId: input.tenantId,
        conversationId: input.conversationId,
        messageType: "text",
        text: response,
        externalMessageId: null,
        idempotencyKey,
        rawPayload: {
          kind: "chitchat",
          model: classifierModel,
          responseIndex: index + 1,
          responseCount: responses.length,
          originalText: chitchatText,
          quote: targetMessage
            ? {
                msg: targetMessage.text,
                externalMessageId: targetMessage.external_message_id,
                id: targetMessage.id,
                data: (targetMessage.raw_payload as any)?.data,
              }
            : undefined,
        },
      });
      savedMessages.push(msgRow);
    }

    return savedMessages;
  }

  let systemPromptOverride: string | undefined;
  const useDbPrompt =
    process.env.USE_DB_PROMPT === "true" ||
    (process.env.USE_DB_PROMPT !== undefined &&
      process.env.USE_DB_PROMPT !== "false" &&
      process.env.USE_DB_PROMPT !== "");

  if (useDbPrompt) {
    const dbPrompt = await repos.prompts.findActive({
      tenantId: input.tenantId,
      key: "assistant",
    });
    if (dbPrompt) {
      systemPromptOverride = dbPrompt.content;
      // Replace placeholders using {{key}}
      const variables: Record<string, string> = {
        contact_name: contactName,
        tenant_id: input.tenantId,
      };
      for (const [k, v] of Object.entries(variables)) {
        systemPromptOverride = systemPromptOverride.replaceAll(`{{${k}}}`, v);
      }
    }
  }

  if (targetMessage) {
    systemPromptOverride =
      (systemPromptOverride || "") +
      `\n\nIMPORTANT: The candidate has sent a message that you are replying to: "${targetMessage.text}". Make sure your response specifically and directly replies to/quotes this message.`;
  }

  // Format messages for the tool-calling agent runner
  const formattedMessages: MockZaloPayload[] = messages.map((m) => ({
    id: m.id,
    tenantId: m.tenant_id,
    channel: "zalo" as const,
    threadId: conversation.external_thread_id,
    externalUserId: m.direction === "inbound" ? externalUserId : "agent",
    text: m.text ?? "",
    receivedAt: new Date(m.created_at).toISOString(),
    raw: (m.raw_payload as Record<string, unknown>) ?? {},
  }));

  const scenario = {
    id: input.conversationId,
    name: input.conversationId,
    description: "Zalo Simulator isolation run.",
    tenantId: input.tenantId,
    channel: "zalo" as const,
    threadId: conversation.external_thread_id,
    externalUserId,
    messages: formattedMessages,
  };

  // Run the tool-loop agent scenario!
  const agentResult = await runHrAgentScenario({
    scenario,
    model,
    useLocalCache: false, // Disable disk cache on serverless Vercel FS
    forceProfileReload: false,
    printCache: false,
    mockLlm: false,
    skillMode: resolveHrSkillMode(process.env.HR_SKILL_MODE),
    systemPromptOverride,
    knownFacts: knownFactsResult?.text,
    onStepFinish: async (step: any) => {
      if (!step.toolCalls || step.toolCalls.length === 0) return;
      for (const call of step.toolCalls) {
        const matchingResult = step.toolResults?.find(
          (r: any) => r.toolCallId === call.toolCallId,
        );
        await repos.audits.append({
          tenantId: input.tenantId,
          conversationId: input.conversationId,
          runId: call.toolCallId,
          toolName: call.toolName,
          inputPayload: call.args,
          outputPayload: matchingResult ? matchingResult.result : null,
          status: matchingResult?.isError ? "error" : "ok",
        });
      }
    },
  });

  const responses = parseDraftResponses(agentResult.assistantText);
  const batchId = `draft:${input.tenantId}:${input.conversationId}:${Date.now()}`;
  const savedMessages: MessageRow[] = [];

  for (const [index, response] of responses.entries()) {
    const idempotencyKey = `${batchId}:${index + 1}`;
    const msgRow = await repos.messages.createOutbound({
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      messageType: "text",
      text: response,
      externalMessageId: null,
      idempotencyKey,
      rawPayload: {
        kind: "agent",
        model,
        responseIndex: index + 1,
        responseCount: responses.length,
        steps: agentResult.steps.length,
        originalText: agentResult.assistantText,
      },
    });
    savedMessages.push(msgRow);
  }

  return savedMessages;
}

async function resolveDefaultModel(
  repos: Repos,
  tenantId: string,
): Promise<string | null> {
  const workflow = await repos.workflows.findLatestByTenant(tenantId);
  return workflow?.default_model ?? null;
}

async function resolveClassifierModel(
  repos: Repos,
  tenantId: string,
): Promise<string | null> {
  const workflow = await repos.workflows.findLatestByTenant(tenantId);
  return workflow?.classifier_model ?? null;
}

function parseDraftResponses(text: string): string[] {
  const parsed = DraftResponsesSchema.safeParse(parseJsonLike(text));
  if (parsed.success) {
    return normalizeResponses(
      Array.isArray(parsed.data) ? parsed.data : parsed.data.responses,
    );
  }

  return normalizeResponses(
    text.split(/\n+/).map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")),
  );
}

function parseJsonLike(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeResponses(responses: string[]): string[] {
  const cleaned = responses
    .flatMap((response) => response.split(/\n+/))
    .map((response) => response.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    throw new Error("OpenRouter response did not include any chat responses");
  }

  return cleaned;
}

export async function generateAndSaveReaction(
  repos: Repos,
  input: {
    tenantId: string;
    conversationId: string;
    targetMessageId: string;
    reaction?: string;
  },
): Promise<MessageRow> {
  const messagesList = await repos.messages.listByConversation({
    conversationId: input.conversationId,
    limit: 100,
  });
  const targetMessage = messagesList.find((m) => m.id === input.targetMessageId);
  if (!targetMessage) {
    throw new Error(`Target message not found: ${input.targetMessageId}`);
  }

  const conversation = await repos.conversations.findById(input.conversationId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${input.conversationId}`);
  }

  let reactionCode = "";

  if (input.reaction) {
    reactionCode = input.reaction;
  } else {
    const model =
      conversation.override_model ||
      (await resolveDefaultModel(repos, input.tenantId)) ||
      "google/gemini-2.5-flash";
    const messagesContext = messagesList
      .slice(-10) // last 10 messages for context
      .map((m) => `${m.direction === "inbound" ? "Candidate" : "Agent"}: ${m.text}`)
      .join("\n");

    const prompt = `You are a conversation reaction helper. Based on the following chat conversation history, select the single most appropriate reaction emoji for the final message.
  
Conversation History:
${messagesContext}

Target Message to react to:
"${targetMessage.text}"

Select exactly ONE emoji reaction from this list:
- HEART (love, care, heart emoji)
- LIKE (thumbs up, agreement)
- HAHA (funny, laugh)
- WOW (surprised, amazed)
- CRY (sad, sorry)
- ANGRY (mad, frustrated)

Response format:
Respond with ONLY the exact reaction name in uppercase, e.g. "HEART" or "LIKE". Do not include any other text, punctuation, or markdown formatting.`;

    console.log(
      `[core:reply] generating reaction for message ${input.targetMessageId} using model ${model}`,
    );
    const modelInstance = createOpenRouterChatModel({ model });
    const result = await generateText({
      model: modelInstance as any,
      prompt,
      maxTokens: 10,
      temperature: 0.1,
    });

    const responseText = result.text.trim().toUpperCase();
    console.log(`[core:reply] reaction response text: ${responseText}`);

    if (responseText.includes("HEART")) reactionCode = "/-heart";
    else if (responseText.includes("LIKE")) reactionCode = "/-strong";
    else if (responseText.includes("HAHA")) reactionCode = ":>";
    else if (responseText.includes("WOW")) reactionCode = ":o";
    else if (responseText.includes("CRY")) reactionCode = ":-((";
    else if (responseText.includes("ANGRY")) reactionCode = ":-h";
    else reactionCode = "/-strong"; // default
  }

  const rawPayload = (targetMessage.raw_payload as Record<string, any>) || {};
  rawPayload.reactions = [
    {
      emoji: reactionCode,
      sender: "agent",
      createdAt: new Date().toISOString(),
    },
  ];
  await repos.messages.updateRawPayload(input.targetMessageId, rawPayload);

  const updatedMessage = await repos.messages.findById(input.targetMessageId);
  if (!updatedMessage) {
    throw new Error(`Failed to reload updated target message: ${input.targetMessageId}`);
  }
  return updatedMessage;
}
