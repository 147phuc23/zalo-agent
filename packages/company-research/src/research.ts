import fs from "fs";
import path from "path";
import { crawlCompanyWebsite } from "./crawl.js";
import { pickRelevantLinks, extractCompanyProfile } from "./extract.js";

function getSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function runCompanyResearch(input: {
  name: string;
  website?: string;
  manualTextFile?: string;
  gapId?: string;
}) {
  const outputDir = path.resolve(process.cwd(), "research-output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const slug = getSlug(input.name);
  const jsonPath = path.join(outputDir, `${slug}.json`);

  let profile: any = null;
  const sourcesLog: any[] = [];

  if (input.manualTextFile) {
    console.log(`[research] Skipping crawl. Reading manual text from ${input.manualTextFile}...`);
    const content = fs.readFileSync(input.manualTextFile, "utf-8");
    sourcesLog.push({
      url: "manual-input",
      kind: "other",
      title: "Manual Text File",
      contentExcerpt: content.slice(0, 200) + "...",
      fetchedAt: new Date().toISOString(),
    });

    console.log(`[research] Extracting profile via LLM...`);
    profile = await extractCompanyProfile(
      input.name,
      input.website || "https://unknown.com",
      content
    );
  } else {
    if (!input.website) {
      throw new Error("Either --website or --manual-text-file must be provided");
    }

    console.log(`[research] Crawling homepage: ${input.website}...`);
    const homepageResult = await crawlCompanyWebsite(input.website, 1);
    if (homepageResult.pages.length === 0) {
      throw new Error(`Failed to load company homepage: ${input.website}`);
    }

    const homepage = homepageResult.pages[0];
    sourcesLog.push({
      url: homepage.url,
      kind: "homepage",
      title: homepage.title,
      contentExcerpt: homepage.excerpt,
      fetchedAt: new Date().toISOString(),
    });

    // In a real run, collect links from homepage, let LLM pick top 5
    // For simplicity, collect same-origin URLs
    const rawLinks = homepage.content.match(/https?:\/\/[^\s"']+/g) || [];
    const uniqueLinks = Array.from(new Set(rawLinks)).filter((l) => l.startsWith(input.website!));

    console.log(`[research] Homepage links collected: ${uniqueLinks.length}`);
    const relevantLinks = await pickRelevantLinks(input.website, uniqueLinks);
    console.log(`[research] LLM picked top relevant links:`, relevantLinks);

    let crawledContent = `Page: Homepage (${homepage.url})\nContent: ${homepage.content}\n\n`;

    for (const url of relevantLinks) {
      try {
        const pageResult = await crawlCompanyWebsite(url, 1);
        if (pageResult.pages.length > 0) {
          const p = pageResult.pages[0];
          crawledContent += `Page: ${p.url}\nTitle: ${p.title}\nContent: ${p.content}\n\n`;
          sourcesLog.push({
            url: p.url,
            kind: "other", // could classify kind via LLM later
            title: p.title,
            contentExcerpt: p.excerpt,
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.warn(`[research] Failed to crawl link ${url}:`, err.message);
      }
    }

    console.log(`[research] Extracting profile via LLM...`);
    profile = await extractCompanyProfile(input.name, input.website, crawledContent);
  }

  // Inject sources metadata into research field
  profile.research = {
    ...profile.research,
    sources: sourcesLog,
    crawledAt: new Date().toISOString(),
    gapId: input.gapId || null,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(profile, null, 2), "utf-8");
  console.log(`[research] Research profile successfully written to ${jsonPath}`);
  console.log(`[research] You can edit this JSON file now, then run: pnpm import --file research-output/${slug}.json`);
}
