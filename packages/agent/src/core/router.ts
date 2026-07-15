import { OpenRouterAiClient } from "@platform/ai-client";
import { PERSONA_EXAMPLES } from "../prompt/core-instructions.js";
import type { CandidateRequirement } from "../types.js";
import { extractLocationSlugs } from "./location-normalizer.js";
import {
  ROLE_VALUES,
  SKILL_VALUES,
  AVAILABILITY_VALUES,
  LANGUAGE_VALUES,
  isRoleValue,
  isAvailabilityValue,
  isLanguageValue,
} from "./requirement-taxonomy.js";

export type RouterMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClassificationResult = {
  category: "CHITCHAT" | "HR_SPECIALIST";
  reason: string;
  normalizedRequirement?: CandidateRequirement;
};

const CLASSIFIER_SYSTEM_PROMPT = `You are a frontline classification and routing assistant for an autonomous recruiting system.
Your goal is to classify the candidate's latest message and short conversation history into one of the following two categories:

1. "CHITCHAT":
- Casual greetings or standard icebreakers (e.g., "Hi", "Hello", "Chào bạn", "Xin chào", "Hi bot").
- Polite phrases, farewells, or simple acknowledgments (e.g., "Cảm ơn", "Tạm biệt", "Dạ vâng", "Ok b").
- Basic FAQs or general chitchat not containing any specific job requirements or candidate profile facts (e.g., "Bạn là ai?", "Bạn làm được gì?", "Có ai ở đó không?").

2. "HR_SPECIALIST":
- The user expresses a clear, explicit intent to find a job or view job listings (e.g., "Mình muốn tìm việc", "Tìm việc giúp mình").
- The user provides specific candidate criteria/requirements such as target role, location, preferred salary, work mode, or years of experience.
- The user uploads or mentions sending/extracting a CV/resume.
- The user asks about their application status, interview schedules, or feedback.
- The user lists their specific skills or background (e.g., "Mình biết làm React", "I am a backend developer").

You must ALSO extract and normalize any candidate job-search requirement information present in the conversation (from the current message or earlier ones), merged with any "Current Requirement" context provided in the prompt. Return it as "normalizedRequirement" with these optional fields:
- role: MUST be exactly one of: ${ROLE_VALUES.join(", ")}. Omit if none match.
- skills: array of lowercase skill names. Prefer these canonical spellings when they match: ${SKILL_VALUES.join(", ")}. If a mentioned skill isn't in this list, still include it in lowercase.
- locationSlugs: array of city names mentioned (free text is fine, it gets re-derived internally).
- workMode: one of "remote", "hybrid", "onsite".
- salaryMinVnd: expected minimum salary in Vietnamese Dong (VND). IMPORTANT: if the candidate gives a salary in USD (e.g. "$2000", "2k usd", "2k đô"), convert it to VND by multiplying by 25,000 (e.g. 2000 USD -> 50000000 VND). Never return a raw USD number in this field.
- yearsOfExperience: number of years of experience mentioned.
- availability: MUST be exactly one of: ${AVAILABILITY_VALUES.join(", ")}. Omit if not mentioned.
- language: MUST be exactly one of: ${LANGUAGE_VALUES.join(", ")}. Omit if not mentioned.
Return the FULL merged requirement (existing + anything new from this message), not just what's new. Omit any field with no information at all (don't guess).

You must respond ONLY with a JSON object containing the fields:
{
  "category": "CHITCHAT" | "HR_SPECIALIST",
  "reason": "Brief justification for the classification",
  "normalizedRequirement": { ... as described above, or {} if nothing to report ... }
}
Do not include any other text, markdown formatting (like \`\`\`json), or explanations outside of the JSON.`;

const CHITCHAT_SYSTEM_PROMPT = `You are a friendly, helpful HR recruiter chat agent for Zalo.
You handle initial greetings, casual chitchat, and general inquiries.
Keep your responses extremely short, warm, and natural (1-2 sentences maximum).
Reply in Vietnamese unless the candidate writes in English.
Add appropriate friendly emojis (e.g., 😊, 👍, ✨).
Do not try to match or recommend jobs, and do not look up CRM records.
If the user asks to find a job or shares their skills/experience, politely transition to finding them a job (but keep it brief).
CRITICAL: If a "Known Facts" block is provided, look at it. If the candidate's target role, location, or other requirements are already known/filled, do NOT ask for those details again. Acknowledge what is already known if relevant, or simply reply warmly without re-asking any known field.

${PERSONA_EXAMPLES}`;

export async function classifyIntent(
  messages: RouterMessage[],
  model: string = "tencent/hy3:free",
  knownFacts?: string,
  currentRequirement?: CandidateRequirement,
): Promise<ClassificationResult> {
  const client = new OpenRouterAiClient();
  const historyText = formatHistory(messages);
  const latestMessageText = messages[messages.length - 1]?.content ?? "";

  let prompt = `Classify the following conversation:\n\n${historyText}\n\nLatest message: ${latestMessageText}`;
  if (currentRequirement && Object.keys(currentRequirement).length > 0) {
    prompt = `Current Requirement (merge new information into this, don't discard existing fields unless contradicted): ${JSON.stringify(currentRequirement)}\n\n${prompt}`;
  }
  if (knownFacts) {
    prompt = `Context:\n${knownFacts}\n\n${prompt}`;
  }

  const response = await client.generate({
    model,
    system: CLASSIFIER_SYSTEM_PROMPT,
    prompt,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
  });

  try {
    const parsed = parseJsonLike(response.text);
    if (parsed && typeof parsed === "object" && "category" in parsed) {
      const category = (parsed as { category: string }).category;
      if (category === "CHITCHAT" || category === "HR_SPECIALIST") {
        const normalizedRequirement = sanitizeNormalizedRequirement(
          (parsed as { normalizedRequirement?: unknown }).normalizedRequirement,
          currentRequirement,
          latestMessageText,
        );
        return {
          category,
          reason: (parsed as { reason?: string }).reason ?? "",
          normalizedRequirement,
        };
      }
    }
  } catch (err) {
    console.error(
      "[router] Failed to parse classification JSON:",
      err,
      "Raw text:",
      response.text,
    );
  }

  // Fallback default
  return {
    category: "HR_SPECIALIST",
    reason: "Fallback due to JSON parsing error.",
    normalizedRequirement: currentRequirement,
  };
}

function sanitizeNormalizedRequirement(
  raw: unknown,
  currentRequirement: CandidateRequirement | undefined,
  latestMessageText: string,
): CandidateRequirement | undefined {
  if (!raw || typeof raw !== "object") {
    return currentRequirement;
  }
  const input = raw as Record<string, unknown>;
  const result: CandidateRequirement = { ...currentRequirement };

  if (typeof input.role === "string" && isRoleValue(input.role)) {
    result.role = input.role;
  }

  if (Array.isArray(input.skills)) {
    const skills = input.skills
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.toLowerCase());
    if (skills.length > 0) result.skills = Array.from(new Set(skills));
  }

  // Never trust the LLM's location slugs literally — re-derive from raw
  // text, same defensive pattern as parse-jobs-to-sql.ts.
  const derivedSlugs = extractLocationSlugs(latestMessageText);
  if (derivedSlugs.length > 0) {
    result.locationSlugs = Array.from(
      new Set([...(currentRequirement?.locationSlugs ?? []), ...derivedSlugs]),
    );
  }

  if (input.workMode === "remote" || input.workMode === "hybrid" || input.workMode === "onsite") {
    result.workMode = input.workMode;
  }

  if (typeof input.salaryMinVnd === "number" && input.salaryMinVnd > 0) {
    result.salaryMinVnd = input.salaryMinVnd;
  }

  if (typeof input.yearsOfExperience === "number" && input.yearsOfExperience >= 0) {
    result.yearsOfExperience = input.yearsOfExperience;
  }

  if (typeof input.availability === "string" && isAvailabilityValue(input.availability)) {
    result.availability = input.availability;
  }

  if (typeof input.language === "string" && isLanguageValue(input.language)) {
    result.language = input.language;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export async function generateChitchatReply(
  messages: RouterMessage[],
  model: string = "tencent/hy3:free",
  knownFacts?: string,
): Promise<string> {
  const client = new OpenRouterAiClient();
  const historyText = formatHistory(messages);

  let prompt = `Generate the next friendly recruiter reply for this conversation:\n\n${historyText}`;
  if (knownFacts) {
    prompt = `Context:\n${knownFacts}\n\n${prompt}`;
  }

  const response = await client.generate({
    model,
    system: CHITCHAT_SYSTEM_PROMPT,
    prompt,
    temperature: 0.7,
  });

  return response.text;
}

function formatHistory(messages: RouterMessage[]): string {
  const recent = messages.slice(-15); // Use last 15 messages for quick context
  return recent.map((m) => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n");
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
