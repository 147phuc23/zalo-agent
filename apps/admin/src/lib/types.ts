export type Conversation = {
  id: string;
  tenantId: string;
  channel: string;
  externalThreadId: string;
  status: string;
  assigneeUserId: string | null;
  overrideModel: string | null;
  lastActivityAt: string;
  createdAt: string;

  contact: { displayName: string | null; externalUserId: string } | null;
};

export type Message = {
  id: string;
  tenantId: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  externalMessageId: string | null;
  idempotencyKey: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  rawPayload?: any;
};

export type Audit = {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  run_id: string | null;
  tool_name: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  status: "ok" | "error";
  created_at: string;
};

export type PromptVersion = {
  id: string;
  tenant_id: string;
  key: string;
  content: string;
  version: number;
  is_active: boolean;
  created_at: string;
};
