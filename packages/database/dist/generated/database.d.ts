export type Json = string | number | boolean | null | {
    [key: string]: Json | undefined;
} | Json[];
export interface Database {
    public: {
        Tables: {
            tenants: {
                Row: {
                    id: string;
                    name: string;
                    timezone: string;
                    locale: string;
                    status: string;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    name: string;
                    timezone?: string;
                    locale?: string;
                    status?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    timezone?: string;
                    locale?: string;
                    status?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            users: {
                Row: {
                    id: string;
                    email: string | null;
                    display_name: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    email?: string | null;
                    display_name?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string | null;
                    display_name?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            tenant_users: {
                Row: {
                    id: string;
                    tenant_id: string;
                    user_id: string;
                    role: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    user_id: string;
                    role: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    user_id?: string;
                    role?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            channel_accounts: {
                Row: {
                    id: string;
                    tenant_id: string;
                    channel: string;
                    external_account_id: string | null;
                    status: string;
                    encrypted_session_blob: string | null;
                    last_seen_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    channel: string;
                    external_account_id?: string | null;
                    status?: string;
                    encrypted_session_blob?: string | null;
                    last_seen_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    channel?: string;
                    external_account_id?: string | null;
                    status?: string;
                    encrypted_session_blob?: string | null;
                    last_seen_at?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            contacts: {
                Row: {
                    id: string;
                    tenant_id: string;
                    channel: string;
                    external_user_id: string;
                    display_name: string | null;
                    phone: string | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    channel: string;
                    external_user_id: string;
                    display_name?: string | null;
                    phone?: string | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    channel?: string;
                    external_user_id?: string;
                    display_name?: string | null;
                    phone?: string | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            conversations: {
                Row: {
                    id: string;
                    tenant_id: string;
                    channel: string;
                    external_thread_id: string;
                    contact_id: string;
                    status: string;
                    assignee_user_id: string | null;
                    last_activity_at: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    channel: string;
                    external_thread_id: string;
                    contact_id: string;
                    status?: string;
                    assignee_user_id?: string | null;
                    last_activity_at?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    channel?: string;
                    external_thread_id?: string;
                    contact_id?: string;
                    status?: string;
                    assignee_user_id?: string | null;
                    last_activity_at?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            messages: {
                Row: {
                    id: string;
                    tenant_id: string;
                    conversation_id: string;
                    direction: "inbound" | "outbound";
                    message_type: "text" | "image" | "sticker" | "file" | "system" | string;
                    text: string | null;
                    external_message_id: string | null;
                    idempotency_key: string;
                    raw_payload: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    conversation_id: string;
                    direction: "inbound" | "outbound";
                    message_type: "text" | "image" | "sticker" | "file" | "system" | string;
                    text?: string | null;
                    external_message_id?: string | null;
                    idempotency_key: string;
                    raw_payload?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    conversation_id?: string;
                    direction?: "inbound" | "outbound";
                    message_type?: "text" | "image" | "sticker" | "file" | "system" | string;
                    text?: string | null;
                    external_message_id?: string | null;
                    idempotency_key?: string;
                    raw_payload?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            message_deliveries: {
                Row: {
                    id: string;
                    tenant_id: string;
                    message_id: string;
                    attempt: number;
                    status: string;
                    error_code: string | null;
                    error_message: string | null;
                    provider_payload: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    message_id: string;
                    attempt?: number;
                    status: string;
                    error_code?: string | null;
                    error_message?: string | null;
                    provider_payload?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    message_id?: string;
                    attempt?: number;
                    status?: string;
                    error_code?: string | null;
                    error_message?: string | null;
                    provider_payload?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            workflow_configs: {
                Row: {
                    id: string;
                    tenant_id: string;
                    mode: "auto" | "approval" | "manual" | "blocked" | string;
                    default_model: string | null;
                    classifier_model: string | null;
                    embedding_model: string | null;
                    max_tool_turns: number;
                    temperature: number;
                    prompt_settings: Json;
                    crm_mapping: Json;
                    blocked_topics: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    mode: "auto" | "approval" | "manual" | "blocked" | string;
                    default_model?: string | null;
                    classifier_model?: string | null;
                    embedding_model?: string | null;
                    max_tool_turns?: number;
                    temperature?: number;
                    prompt_settings?: Json;
                    crm_mapping?: Json;
                    blocked_topics?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    mode?: "auto" | "approval" | "manual" | "blocked" | string;
                    default_model?: string | null;
                    classifier_model?: string | null;
                    embedding_model?: string | null;
                    max_tool_turns?: number;
                    temperature?: number;
                    prompt_settings?: Json;
                    crm_mapping?: Json;
                    blocked_topics?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            tool_call_audits: {
                Row: {
                    id: string;
                    tenant_id: string;
                    conversation_id: string | null;
                    run_id: string | null;
                    tool_name: string;
                    input: Json;
                    output: Json | null;
                    status: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    conversation_id?: string | null;
                    run_id?: string | null;
                    tool_name: string;
                    input?: Json;
                    output?: Json | null;
                    status?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    conversation_id?: string | null;
                    run_id?: string | null;
                    tool_name?: string;
                    input?: Json;
                    output?: Json | null;
                    status?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            human_tasks: {
                Row: {
                    id: string;
                    tenant_id: string;
                    conversation_id: string | null;
                    type: "approval" | "handoff" | string;
                    status: string;
                    payload: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    conversation_id?: string | null;
                    type: "approval" | "handoff" | string;
                    status?: string;
                    payload?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    conversation_id?: string | null;
                    type?: "approval" | "handoff" | string;
                    status?: string;
                    payload?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            knowledge_documents: {
                Row: {
                    id: string;
                    tenant_id: string;
                    source_type: string;
                    title: string;
                    content: string;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    source_type: string;
                    title: string;
                    content: string;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    source_type?: string;
                    title?: string;
                    content?: string;
                    metadata?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            knowledge_chunks: {
                Row: {
                    id: string;
                    tenant_id: string;
                    document_id: string;
                    chunk_index: number;
                    content: string;
                    embedding: Json | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    document_id: string;
                    chunk_index: number;
                    content: string;
                    embedding?: Json | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    document_id?: string;
                    chunk_index?: number;
                    content?: string;
                    embedding?: Json | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            external_refs: {
                Row: {
                    id: string;
                    tenant_id: string;
                    system: string;
                    local_id: string | null;
                    remote_id: string;
                    remote_type: string;
                    unique_key_hash: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    tenant_id: string;
                    system: string;
                    local_id?: string | null;
                    remote_id: string;
                    remote_type: string;
                    unique_key_hash: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    tenant_id?: string;
                    system?: string;
                    local_id?: string | null;
                    remote_id?: string;
                    remote_type?: string;
                    unique_key_hash?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
}
