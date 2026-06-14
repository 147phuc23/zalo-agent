import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function POST(req: Request) {
  try {
    const { content, filename } = await req.json();
    if (!content || !filename) {
      return NextResponse.json({ ok: false, error: "Missing content or filename" }, { status: 400 });
    }

    // Resolve the workspace root containing the 'logs' folder
    let currentDir = process.cwd();
    let logsDir = path.join(currentDir, "logs");
    let found = false;

    // Walk up up to 4 levels to find 'logs' directory
    for (let i = 0; i < 4; i++) {
      try {
        const stats = await fs.stat(logsDir);
        if (stats.isDirectory()) {
          found = true;
          break;
        }
      } catch {
        // Not found, go up
        currentDir = path.dirname(currentDir);
        logsDir = path.join(currentDir, "logs");
      }
    }

    // Ensure the directory exists
    await fs.mkdir(logsDir, { recursive: true });

    const filePath = path.join(logsDir, filename);
    await fs.writeFile(filePath, content, "utf-8");

    return NextResponse.json({ ok: true, filePath });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
