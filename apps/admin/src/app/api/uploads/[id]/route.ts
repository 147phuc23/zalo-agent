import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { createStorage } from "@platform/storage";

export const runtime = "nodejs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const doc = await getRepos().documents.findById(id);
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storage = createStorage();
    await storage.putObject(doc.storage_key, buffer, doc.mime_type);

    // Mark database row 'uploaded' and set size_bytes
    await getRepos().documents.markUploaded(id, buffer.length);

    return NextResponse.json({
      ok: true,
      message: "Uploaded successfully",
      sizeBytes: buffer.length,
    });
  } catch (err) {
    console.error("[api/uploads] PUT failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
