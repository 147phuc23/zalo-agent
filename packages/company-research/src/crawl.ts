import { chromium } from "playwright";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface CrawledPage {
  url: string;
  title: string;
  excerpt: string;
  content: string;
}

export async function crawlCompanyWebsite(homepageUrl: string, maxPages = 6): Promise<{
  pages: CrawledPage[];
}> {
  console.log(`[crawler] Launching browser for ${homepageUrl}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const crawled: Map<string, CrawledPage> = new Map();
  const queue: string[] = [homepageUrl];
  const origin = new URL(homepageUrl).origin;

  const normalizeUrl = (urlStr: string): string | null => {
    try {
      const u = new URL(urlStr, homepageUrl);
      // Remove hash/search params
      u.hash = "";
      u.search = "";
      if (u.origin !== origin) return null;
      return u.toString();
    } catch {
      return null;
    }
  };

  while (queue.length > 0 && crawled.size < maxPages) {
    const current = queue.shift()!;
    if (crawled.has(current)) continue;

    console.log(`[crawler] Loading page: ${current}`);
    try {
      await page.goto(current, { waitUntil: "networkidle", timeout: 15000 });
      const html = await page.content();
      const bodyText = await page.evaluate(() => document.body?.innerText || "");
      const title = await page.title();

      // Collect same-origin links
      const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a"))
          .map((a) => a.getAttribute("href"))
          .filter((h): h is string => typeof h === "string");
      });

      for (const h of hrefs) {
        const norm = normalizeUrl(h);
        if (norm && !crawled.has(norm) && !queue.includes(norm) && norm !== current) {
          queue.push(norm);
        }
      }

      // Extract text content using Readability
      const dom = new JSDOM(html, { url: current });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      let mainContent = article?.textContent?.trim() || "";
      if (mainContent.length < 500) {
        mainContent = bodyText.trim();
      }

      // Excerpt and clean up content (limit to 8k chars)
      const cleanedText = mainContent.replace(/\s+/g, " ").slice(0, 8000);
      const excerpt = article?.excerpt?.trim() || cleanedText.slice(0, 200) + "...";

      crawled.set(current, {
        url: current,
        title: title || article?.title || "No Title",
        excerpt,
        content: cleanedText,
      });

    } catch (err: any) {
      console.warn(`[crawler] Failed to load ${current}:`, err.message);
    }
  }

  await browser.close();
  return { pages: Array.from(crawled.values()) };
}
