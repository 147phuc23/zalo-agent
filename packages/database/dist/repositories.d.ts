import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./generated/database.js";
export type DatabaseClient = SupabaseClient<Database>;
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type HumanTaskRow = Database["public"]["Tables"]["human_tasks"]["Row"];
type ToolCallAuditRow = Database["public"]["Tables"]["tool_call_audits"]["Row"];
export declare function createTenantRepository(client: DatabaseClient): {
    ensureExists(input: {
        tenantId: string;
        name: string;
        timezone: string;
        locale: string;
    }): Promise<void>;
};
export declare function createContactRepository(client: DatabaseClient): {
    findByExternalUser(input: {
        tenantId: string;
        channel: string;
        externalUserId: string;
    }): Promise<{
        id: string;
        tenant_id: string;
        channel: string;
        external_user_id: string;
        display_name: string | null;
        phone: string | null;
        metadata: Json;
        created_at: string;
    } | null>;
    listByIds(input: {
        ids: string[];
    }): Promise<{
        id: string;
        tenant_id: string;
        channel: string;
        external_user_id: string;
        display_name: string | null;
        phone: string | null;
        metadata: Json;
        created_at: string;
    }[]>;
    createShadow(input: {
        tenantId: string;
        channel: string;
        externalUserId: string;
        displayName?: string | null;
        phone?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<{
        id: string;
        tenant_id: string;
        channel: string;
        external_user_id: string;
        display_name: string | null;
        phone: string | null;
        metadata: Json;
        created_at: string;
    }>;
};
export declare function createConversationRepository(client: DatabaseClient): {
    findByExternalThread(input: {
        tenantId: string;
        channel: string;
        externalThreadId: string;
    }): Promise<{
        id: string;
        tenant_id: string;
        channel: string;
        external_thread_id: string;
        contact_id: string;
        status: string;
        assignee_user_id: string | null;
        last_activity_at: string;
        created_at: string;
    } | null>;
    findById(conversationId: string): Promise<{
        id: string;
        tenant_id: string;
        channel: string;
        external_thread_id: string;
        contact_id: string;
        status: string;
        assignee_user_id: string | null;
        last_activity_at: string;
        created_at: string;
    } | null>;
    listByTenant(input: {
        tenantId: string;
        limit: number;
    }): Promise<{
        id: string;
        tenant_id: string;
        channel: string;
        external_thread_id: string;
        contact_id: string;
        status: string;
        assignee_user_id: string | null;
        last_activity_at: string;
        created_at: string;
    }[]>;
    create(input: {
        tenantId: string;
        channel: string;
        externalThreadId: string;
        contactId: string;
        status?: string;
        assigneeUserId?: string | null;
        lastActivityAt?: string;
    }): Promise<{
        id: string;
        tenant_id: string;
        channel: string;
        external_thread_id: string;
        contact_id: string;
        status: string;
        assignee_user_id: string | null;
        last_activity_at: string;
        created_at: string;
    }>;
    updateLastActivity(conversationId: string, lastActivityAt: string): Promise<void>;
    updateAssignee(conversationId: string, assigneeUserId: string | null): Promise<void>;
    updateStatus(conversationId: string, status: string): Promise<void>;
};
export declare function createMessageRepository(client: DatabaseClient): {
    listByConversation(input: {
        conversationId: string;
        limit: number;
    }): Promise<{
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
    }[]>;
    findLatestByExternalMessageId(input: {
        tenantId: string;
        externalMessageId: string;
    }): Promise<{
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
    } | null>;
    createInbound(input: {
        tenantId: string;
        conversationId: string;
        messageType: MessageRow["message_type"];
        text?: string | null;
        externalMessageId?: string | null;
        idempotencyKey: string;
        rawPayload: Record<string, unknown>;
    }): Promise<void>;
    createOutbound(input: {
        tenantId: string;
        conversationId: string;
        messageType: MessageRow["message_type"];
        text: string;
        externalMessageId?: string | null;
        idempotencyKey: string;
        rawPayload: Record<string, unknown>;
    }): Promise<void>;
};
export declare function createDeliveryRepository(client: DatabaseClient): {
    create(input: {
        tenantId: string;
        messageId: string;
        status: string;
        attempt?: number;
        errorCode?: string | null;
        errorMessage?: string | null;
        providerPayload?: Record<string, unknown>;
    }): Promise<void>;
};
export declare function createWorkflowConfigRepository(client: DatabaseClient): {
    findLatestByTenant(tenantId: string): Promise<{
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
    } | null>;
};
export declare function createHumanTaskRepository(client: DatabaseClient): {
    create(input: {
        tenantId: string;
        conversationId?: string | null;
        type: HumanTaskRow["type"];
        status?: string;
        payload?: Record<string, unknown>;
    }): Promise<void>;
};
export declare function createAuditRepository(client: DatabaseClient): {
    append(input: {
        tenantId: string;
        conversationId?: string | null;
        runId?: string | null;
        toolName: string;
        inputPayload?: Record<string, unknown>;
        outputPayload?: Record<string, unknown> | null;
        status?: ToolCallAuditRow["status"];
    }): Promise<void>;
};
export declare function createRepositorySet(client: DatabaseClient): {
    tenants: {
        ensureExists(input: {
            tenantId: string;
            name: string;
            timezone: string;
            locale: string;
        }): Promise<void>;
    };
    contacts: {
        findByExternalUser(input: {
            tenantId: string;
            channel: string;
            externalUserId: string;
        }): Promise<{
            id: string;
            tenant_id: string;
            channel: string;
            external_user_id: string;
            display_name: string | null;
            phone: string | null;
            metadata: Json;
            created_at: string;
        } | null>;
        listByIds(input: {
            ids: string[];
        }): Promise<{
            id: string;
            tenant_id: string;
            channel: string;
            external_user_id: string;
            display_name: string | null;
            phone: string | null;
            metadata: Json;
            created_at: string;
        }[]>;
        createShadow(input: {
            tenantId: string;
            channel: string;
            externalUserId: string;
            displayName?: string | null;
            phone?: string | null;
            metadata?: Record<string, unknown>;
        }): Promise<{
            id: string;
            tenant_id: string;
            channel: string;
            external_user_id: string;
            display_name: string | null;
            phone: string | null;
            metadata: Json;
            created_at: string;
        }>;
    };
    conversations: {
        findByExternalThread(input: {
            tenantId: string;
            channel: string;
            externalThreadId: string;
        }): Promise<{
            id: string;
            tenant_id: string;
            channel: string;
            external_thread_id: string;
            contact_id: string;
            status: string;
            assignee_user_id: string | null;
            last_activity_at: string;
            created_at: string;
        } | null>;
        findById(conversationId: string): Promise<{
            id: string;
            tenant_id: string;
            channel: string;
            external_thread_id: string;
            contact_id: string;
            status: string;
            assignee_user_id: string | null;
            last_activity_at: string;
            created_at: string;
        } | null>;
        listByTenant(input: {
            tenantId: string;
            limit: number;
        }): Promise<{
            id: string;
            tenant_id: string;
            channel: string;
            external_thread_id: string;
            contact_id: string;
            status: string;
            assignee_user_id: string | null;
            last_activity_at: string;
            created_at: string;
        }[]>;
        create(input: {
            tenantId: string;
            channel: string;
            externalThreadId: string;
            contactId: string;
            status?: string;
            assigneeUserId?: string | null;
            lastActivityAt?: string;
        }): Promise<{
            id: string;
            tenant_id: string;
            channel: string;
            external_thread_id: string;
            contact_id: string;
            status: string;
            assignee_user_id: string | null;
            last_activity_at: string;
            created_at: string;
        }>;
        updateLastActivity(conversationId: string, lastActivityAt: string): Promise<void>;
        updateAssignee(conversationId: string, assigneeUserId: string | null): Promise<void>;
        updateStatus(conversationId: string, status: string): Promise<void>;
    };
    messages: {
        listByConversation(input: {
            conversationId: string;
            limit: number;
        }): Promise<{
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
        }[]>;
        findLatestByExternalMessageId(input: {
            tenantId: string;
            externalMessageId: string;
        }): Promise<{
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
        } | null>;
        createInbound(input: {
            tenantId: string;
            conversationId: string;
            messageType: MessageRow["message_type"];
            text?: string | null;
            externalMessageId?: string | null;
            idempotencyKey: string;
            rawPayload: Record<string, unknown>;
        }): Promise<void>;
        createOutbound(input: {
            tenantId: string;
            conversationId: string;
            messageType: MessageRow["message_type"];
            text: string;
            externalMessageId?: string | null;
            idempotencyKey: string;
            rawPayload: Record<string, unknown>;
        }): Promise<void>;
    };
    deliveries: {
        create(input: {
            tenantId: string;
            messageId: string;
            status: string;
            attempt?: number;
            errorCode?: string | null;
            errorMessage?: string | null;
            providerPayload?: Record<string, unknown>;
        }): Promise<void>;
    };
    workflows: {
        findLatestByTenant(tenantId: string): Promise<{
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
        } | null>;
    };
    tasks: {
        create(input: {
            tenantId: string;
            conversationId?: string | null;
            type: HumanTaskRow["type"];
            status?: string;
            payload?: Record<string, unknown>;
        }): Promise<void>;
    };
    audits: {
        append(input: {
            tenantId: string;
            conversationId?: string | null;
            runId?: string | null;
            toolName: string;
            inputPayload?: Record<string, unknown>;
            outputPayload?: Record<string, unknown> | null;
            status?: ToolCallAuditRow["status"];
        }): Promise<void>;
    };
};
export {};
