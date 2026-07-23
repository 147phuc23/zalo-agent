import { OpenRouterAiClient } from "@platform/ai-client";
import { CompanyResearchJsonSchema, type CompanyResearchJson } from "./schema.js";

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "cohere/north-mini-code:free";

export async function pickRelevantLinks(
  homepageUrl: string,
  links: string[],
  model: string = DEFAULT_MODEL
): Promise<string[]> {
  const client = new OpenRouterAiClient();
  const system = `You are a web crawler link filter. Select up to 5 URLs that are highly relevant to finding the company's introduction, leadership, team, products, blog, or careers. Return a JSON object with a single field 'urls' containing the selected URLs.`;
  const prompt = `Homepage: ${homepageUrl}\nLinks found:\n${links.map((l) => `- ${l}`).join("\n")}`;

  try {
    const res = await client.generate({
      model,
      system,
      prompt,
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(res.text);
    if (parsed && Array.isArray(parsed.urls)) {
      return parsed.urls.filter((u: any) => typeof u === "string");
    }
  } catch (err) {
    console.error("[extractor] Failed to pick relevant links via LLM:", err);
  }
  
  // Simple regex fallback
  const keywords = [/about/i, /team/i, /leadership/i, /product/i, /career/i, /job/i, /blog/i];
  return links
    .filter((l) => keywords.some((k) => k.test(l)))
    .slice(0, 5);
}

export async function extractCompanyProfile(
  companyName: string,
  homepageUrl: string,
  crawledContent: string,
  model: string = DEFAULT_MODEL
): Promise<CompanyResearchJson> {
  const client = new OpenRouterAiClient();
  const system = `You are an expert market researcher. Analyze the company website content and extract detailed structured information about the company.
You MUST output a valid JSON object matching this schema:
{
  "name": "Exact company name",
  "website": "Official website URL",
  "introduction": "Detailed introduction of the company",
  "benefits": "Key benefits and perks offered",
  "workStyle": "Description of work environment/style",
  "leadership": [
    { "name": "Name of leader", "title": "Title (e.g. CEO, CTO)", "bio": "Short bio or background", "source_url": "URL where found" }
  ],
  "products": [
    { "name": "Product name", "description": "Short description", "url": "Optional product URL" }
  ],
  "materials": [
    { "type": "book|blog|video|press|other", "title": "Material title", "url": "URL of material", "description": "Optional desc" }
  ],
  "interviewProcess": [
    { "round": 1, "name": "Stage/Round Name", "description": "Short description of what happens in this round" }
  ],
  "research": {} // freeform metadata like crawl count, model, notes
}
Ensure all URLs are absolute and valid.`;

  const prompt = `Company name: ${companyName}\nWebsite: ${homepageUrl}\n\nCrawled page contents:\n${crawledContent}`;

  let retries = 1;
  while (retries >= 0) {
    try {
      const res = await client.generate({
        model,
        system,
        prompt,
        responseFormat: { type: "json_object" },
      });
      const parsed = JSON.parse(res.text);
      const validated = CompanyResearchJsonSchema.parse(parsed);
      return validated;
    } catch (err: any) {
      console.warn(`[extractor] Extraction failed (retries left ${retries}):`, err.message || err);
      if (retries === 0) throw err;
      retries--;
    }
  }
  throw new Error("Failed to extract company profile");
}
