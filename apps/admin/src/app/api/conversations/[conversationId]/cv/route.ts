import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const apiBaseUrl = process.env.API_BASE_URL;
  const token = process.env.INTERNAL_INGEST_TOKEN;
  const tenantId = process.env.TENANT_ID;

  if (!apiBaseUrl || !token || !tenantId) {
    return NextResponse.json(
      { ok: false, error: "missing env API_BASE_URL/INTERNAL_INGEST_TOKEN/TENANT_ID" },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const originalName = file.name;
    const fileExt = path.extname(originalName);
    const baseName = path.basename(originalName, fileExt);
    const sanitizedBase = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");
    const fileName = `${sanitizedBase}-${Date.now()}${fileExt}`;

    // Ensure uploads directory exists and write file
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(path.join(uploadsDir, fileName), Buffer.from(fileBuffer));

    // Determine public URL of the file
    const reqUrl = new URL(req.url);
    const fileUrl = `${reqUrl.origin}/uploads/${fileName}`;

    // Get conversation details to retrieve threadId and senderExternalId
    const convsUrl = new URL("/internal/conversations", apiBaseUrl);
    convsUrl.searchParams.set("tenantId", tenantId);
    const convsRes = await fetch(convsUrl, {
      headers: { authorization: `Bearer ${token}` },
    });
    
    if (!convsRes.ok) {
      return NextResponse.json(
        { ok: false, error: `Failed to fetch conversations: ${convsRes.statusText}` },
        { status: convsRes.status }
      );
    }

    const convsData = await convsRes.json();
    const conversation = convsData.conversations?.find((c: any) => c.id === conversationId);

    if (!conversation) {
      return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    }

    const threadId = conversation.externalThreadId;
    const senderExternalId = conversation.contact?.externalUserId ?? "simulator-user";

    // Simulate Zalo message.received event for the file
    const eventsUrl = new URL("/internal/events", apiBaseUrl);
    const idempotencyKey = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const eventPayload = {
      events: [
        {
          kind: "message.received",
          tenantId,
          channel: "zalo",
          threadId,
          senderExternalId,
          messageType: "file",
          text: `Uploaded CV: ${originalName}`,
          attachments: [
            {
              type: "file",
              url: fileUrl,
              name: originalName,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
            },
          ],
          receivedAt: new Date().toISOString(),
          idempotencyKey,
          rawPayload: {
            source: "zalo-simulator",
            context: {},
            attachments: [
              {
                type: "file",
                url: fileUrl,
                name: originalName,
                mimeType: file.type || "application/octet-stream",
                sizeBytes: file.size,
              },
            ],
          },
        },
      ],
    };

    const eventRes = await fetch(eventsUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventPayload),
    });

    if (!eventRes.ok) {
      const errorText = await eventRes.text();
      return NextResponse.json(
        { ok: false, error: `Failed to ingest event: ${errorText}` },
        { status: eventRes.status }
      );
    }

    const eventData = await eventRes.json();
    return NextResponse.json({
      ok: true,
      fileUrl,
      fileName,
      eventResult: eventData,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
