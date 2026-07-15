import { describe, expect, it, vi, beforeEach } from "vitest";
import { CompanyResearchJsonSchema } from "./schema.js";

vi.mock("playwright", () => {
  return {
    chromium: {
      launch: async () => {
        return {
          newContext: async () => {
            return {
              newPage: async () => {
                return {
                  goto: async () => {},
                  content: async () => "<html><body><h1>Fixture Corp</h1><a href='/about'>About</a></body></html>",
                  evaluate: async (fn: any) => {
                    const str = fn.toString();
                    if (str.includes("document.body?.innerText")) {
                      return "This is the innerText of the mock homepage for Fixture Corp.";
                    }
                    if (str.includes("document.querySelectorAll")) {
                      return ["https://fixturecorp.com/about"];
                    }
                    return "";
                  },
                  title: async () => "Fixture Corp - Home",
                };
              },
            };
          },
          close: async () => {},
        };
      },
    },
  };
});

const mockGenerate = vi.fn();
vi.mock("@platform/ai-client", () => {
  return {
    OpenRouterAiClient: class {
      generate = mockGenerate;
    },
  };
});

import { crawlCompanyWebsite } from "./crawl.js";
import { extractCompanyProfile } from "./extract.js";

describe("Company Research Crawler and Extractor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGenerate.mockReset();
  });

  it("should crawl a website mock page successfully", async () => {
    const res = await crawlCompanyWebsite("https://fixturecorp.com", 1);
    expect(res.pages.length).toBe(1);
    expect(res.pages[0].url).toBe("https://fixturecorp.com");
    expect(res.pages[0].title).toBe("Fixture Corp - Home");
    expect(res.pages[0].content).toContain("mock homepage for Fixture Corp");
  });

  it("should extract structured company profile from crawled text using LLM mock response", async () => {
    const mockJson = {
      name: "Fixture Corp",
      website: "https://fixturecorp.com",
      introduction: "A dummy company created for unit test fixtures.",
      benefits: "Health insurance, remote support.",
      workStyle: "High autonomy.",
      leadership: [
        { name: "John Doe", title: "Founder", bio: "Tech entrepreneur", source_url: "https://fixturecorp.com/about" }
      ],
      products: [
        { name: "Fixture Engine", description: "Mock rendering tool", url: "https://fixturecorp.com/products" }
      ],
      materials: [],
      research: {},
    };

    mockGenerate.mockResolvedValue({
      text: JSON.stringify(mockJson),
      model: "google/gemini-2.5-flash",
    });

    const profile = await extractCompanyProfile(
      "Fixture Corp",
      "https://fixturecorp.com",
      "This is dummy crawled text."
    );

    const validated = CompanyResearchJsonSchema.parse(profile);
    expect(validated.name).toBe("Fixture Corp");
    expect(validated.leadership.length).toBe(1);
    expect(validated.leadership[0].name).toBe("John Doe");
    expect(validated.products[0].name).toBe("Fixture Engine");
  });
});
