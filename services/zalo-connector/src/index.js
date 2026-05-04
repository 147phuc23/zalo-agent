import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ThreadType, Zalo } from "zca-js";
import { createInboundMessageEvent } from "../../../packages/shared/src/message.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../data");
const CREDENTIALS_FILE = path.join(DATA_DIR, "credentials.json");
const INBOUND_LOG_FILE = path.join(DATA_DIR, "inbound.ndjson");
const LEGACY_CREDENTIALS_FILE = path.resolve(__dirname, "../../../credentials.json");

ensureDataDir();

const zalo = new Zalo();
const api = await login();

api.listener.on("message", async (message) => {
  const normalizedEvent = normalizeInboundMessage(message);

  if (!normalizedEvent) {
    return;
  }

  appendInboundEvent(normalizedEvent);

  console.log(
    `[zalo-connector] inbound ${normalizedEvent.threadId}: ${normalizedEvent.text}`,
  );
});

api.listener.start();
console.log("[zalo-connector] listener started");

async function login() {
  migrateLegacyCredentials();

  if (fs.existsSync(CREDENTIALS_FILE)) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    const connectedApi = await zalo.login(credentials);
    console.log("[zalo-connector] logged in with saved credentials");
    return connectedApi;
  }

  const connectedApi = await zalo.loginQR();
  const context = connectedApi.getContext();
  const credentials = {
    imei: context.imei,
    userAgent: context.userAgent,
    cookie: context.cookie.toJSON(),
  };

  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  console.log(`[zalo-connector] saved credentials to ${CREDENTIALS_FILE}`);

  return connectedApi;
}

function normalizeInboundMessage(message) {
  if (message.isSelf) {
    return null;
  }

  const text = readTextContent(message);

  if (!text) {
    return null;
  }

  if (message.type !== ThreadType.User && message.type !== ThreadType.Group) {
    return null;
  }

  return createInboundMessageEvent({
    channel: "zalo",
    threadId: String(message.threadId),
    senderId: String(message.data.uidFrom ?? message.data.fromId ?? "unknown"),
    text,
    raw: {
      type: message.type,
      data: message.data,
    },
  });
}

function readTextContent(message) {
  if (typeof message?.data?.content === "string") {
    return message.data.content.trim();
  }

  return "";
}

function appendInboundEvent(event) {
  fs.appendFileSync(INBOUND_LOG_FILE, `${JSON.stringify(event)}\n`);
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function migrateLegacyCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE) || !fs.existsSync(LEGACY_CREDENTIALS_FILE)) {
    return;
  }

  fs.copyFileSync(LEGACY_CREDENTIALS_FILE, CREDENTIALS_FILE);
  console.log("[zalo-connector] migrated legacy credentials into service data");
}
