import type pg from "pg";
export type DatabaseClient = pg.Pool;
export interface TenantRow {
    id: string;
    name: string;
    timezone: string;
    locale: string;
    status: string;
    created_at: string;
}
export interface UserRow {
    id: string;
    email: string | null;
    display_name: string | null;
    created_at: string;
}
export interface TenantUserRow {
    id: string;
    tenant_id: string;
    user_id: string;
    role: string;
    created_at: string;
}
export interface ChannelAccountRow {
    id: string;
    tenant_id: string;
    channel: string;
    external_account_id: string | null;
    status: string;
    encrypted_session_blob: string | null;
    last_seen_at: string | null;
    created_at: string;
}
export interface ContactRow {
    id: string;
    tenant_id: string;
    channel: string;
    external_user_id: string;
    display_name: string | null;
    phone: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}
export interface ConversationRow {
    id: string;
    tenant_id: string;
    channel: string;
    external_thread_id: string;
    contact_id: string;
    status: string;
    assignee_user_id: string | null;
    override_model: string | null;
    last_activity_at: string;
    created_at: string;
}
export interface MessageRow {
    id: string;
    tenant_id: string;
    conversation_id: string;
    direction: "inbound" | "outbound";
    message_type: string;
    text: string | null;
    external_message_id: string | null;
    idempotency_key: string;
    raw_payload: Record<string, unknown>;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
}
export interface MessageDeliveryRow {
    id: string;
    tenant_id: string;
    message_id: string;
    attempt: number;
    status: string;
    error_code: string | null;
    error_message: string | null;
    provider_payload: Record<string, unknown>;
    created_at: string;
}
export interface WorkflowConfigRow {
    id: string;
    tenant_id: string;
    mode: "auto" | "approval" | "manual" | "blocked";
    default_model: string | null;
    classifier_model: string | null;
    embedding_model: string | null;
    max_tool_turns: number;
    temperature: number;
    prompt_settings: Record<string, unknown>;
    crm_mapping: Record<string, unknown>;
    blocked_topics: unknown[];
    created_at: string;
}
export interface ToolCallAuditRow {
    id: string;
    tenant_id: string;
    conversation_id: string | null;
    run_id: string | null;
    tool_name: string;
    input: Record<string, unknown>;
    output: Record<string, unknown> | null;
    status: "ok" | "error";
    created_at: string;
}
export interface HumanTaskRow {
    id: string;
    tenant_id: string;
    conversation_id: string | null;
    type: "approval" | "handoff";
    status: string;
    payload: Record<string, unknown>;
    created_at: string;
}
export interface PromptTemplateRow {
    id: string;
    tenant_id: string;
    key: string;
    content: string;
    version: number;
    is_active: boolean;
    created_at: string;
}
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
    }): Promise<ContactRow>;
    listByIds(input: {
        ids: string[];
    }): Promise<ContactRow[]>;
    createShadow(input: {
        tenantId: string;
        channel: string;
        externalUserId: string;
        displayName?: string | null;
        phone?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<ContactRow>;
};
export declare function createConversationRepository(client: DatabaseClient): {
    findByExternalThread(input: {
        tenantId: string;
        channel: string;
        externalThreadId: string;
    }): Promise<ConversationRow>;
    findById(conversationId: string): Promise<ConversationRow>;
    listByTenant(input: {
        tenantId: string;
        limit: number;
    }): Promise<ConversationRow[]>;
    create(input: {
        tenantId: string;
        channel: string;
        externalThreadId: string;
        contactId: string;
        status?: string;
        assigneeUserId?: string | null;
        overrideModel?: string | null;
        lastActivityAt?: string;
    }): Promise<ConversationRow>;
    updateLastActivity(conversationId: string, lastActivityAt: string): Promise<void>;
    updateAssignee(conversationId: string, assigneeUserId: string | null): Promise<void>;
    updateStatus(conversationId: string, status: string): Promise<void>;
    updateOverrideModel(conversationId: string, overrideModel: string | null): Promise<void>;
};
export declare function createMessageRepository(client: DatabaseClient): {
    listByConversation(input: {
        conversationId: string;
        limit: number;
    }): Promise<MessageRow[]>;
    findLatestByExternalMessageId(input: {
        tenantId: string;
        externalMessageId: string;
    }): Promise<MessageRow>;
    createInbound(input: {
        tenantId: string;
        conversationId: string;
        messageType: string;
        text?: string | null;
        externalMessageId?: string | null;
        idempotencyKey: string;
        rawPayload: Record<string, unknown>;
    }): Promise<MessageRow>;
    createOutbound(input: {
        tenantId: string;
        conversationId: string;
        messageType: string;
        text: string;
        externalMessageId?: string | null;
        idempotencyKey: string;
        rawPayload: Record<string, unknown>;
    }): Promise<MessageRow>;
    markAsRead(conversationId: string): Promise<void>;
    findById(id: string): Promise<MessageRow | null>;
    updateRawPayload(id: string, rawPayload: Record<string, unknown>): Promise<void>;
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
    findLatestByTenant(tenantId: string): Promise<WorkflowConfigRow>;
};
export declare function createHumanTaskRepository(client: DatabaseClient): {
    create(input: {
        tenantId: string;
        conversationId?: string | null;
        type: "approval" | "handoff";
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
        status?: "ok" | "error";
    }): Promise<ToolCallAuditRow>;
    listByConversation(conversationId: string): Promise<ToolCallAuditRow[]>;
};
export declare function createPromptTemplateRepository(client: DatabaseClient): {
    findActive(input: {
        tenantId: string;
        key: string;
    }): Promise<PromptTemplateRow>;
    create(input: {
        tenantId: string;
        key: string;
        content: string;
        version: number;
    }): Promise<PromptTemplateRow>;
    listVersions(input: {
        tenantId: string;
        key: string;
    }): Promise<PromptTemplateRow[]>;
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
        }): Promise<ContactRow>;
        listByIds(input: {
            ids: string[];
        }): Promise<ContactRow[]>;
        createShadow(input: {
            tenantId: string;
            channel: string;
            externalUserId: string;
            displayName?: string | null;
            phone?: string | null;
            metadata?: Record<string, unknown>;
        }): Promise<ContactRow>;
    };
    conversations: {
        findByExternalThread(input: {
            tenantId: string;
            channel: string;
            externalThreadId: string;
        }): Promise<ConversationRow>;
        findById(conversationId: string): Promise<ConversationRow>;
        listByTenant(input: {
            tenantId: string;
            limit: number;
        }): Promise<ConversationRow[]>;
        create(input: {
            tenantId: string;
            channel: string;
            externalThreadId: string;
            contactId: string;
            status?: string;
            assigneeUserId?: string | null;
            overrideModel?: string | null;
            lastActivityAt?: string;
        }): Promise<ConversationRow>;
        updateLastActivity(conversationId: string, lastActivityAt: string): Promise<void>;
        updateAssignee(conversationId: string, assigneeUserId: string | null): Promise<void>;
        updateStatus(conversationId: string, status: string): Promise<void>;
        updateOverrideModel(conversationId: string, overrideModel: string | null): Promise<void>;
    };
    messages: {
        listByConversation(input: {
            conversationId: string;
            limit: number;
        }): Promise<MessageRow[]>;
        findLatestByExternalMessageId(input: {
            tenantId: string;
            externalMessageId: string;
        }): Promise<MessageRow>;
        createInbound(input: {
            tenantId: string;
            conversationId: string;
            messageType: string;
            text?: string | null;
            externalMessageId?: string | null;
            idempotencyKey: string;
            rawPayload: Record<string, unknown>;
        }): Promise<MessageRow>;
        createOutbound(input: {
            tenantId: string;
            conversationId: string;
            messageType: string;
            text: string;
            externalMessageId?: string | null;
            idempotencyKey: string;
            rawPayload: Record<string, unknown>;
        }): Promise<MessageRow>;
        markAsRead(conversationId: string): Promise<void>;
        findById(id: string): Promise<MessageRow | null>;
        updateRawPayload(id: string, rawPayload: Record<string, unknown>): Promise<void>;
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
        findLatestByTenant(tenantId: string): Promise<WorkflowConfigRow>;
    };
    tasks: {
        create(input: {
            tenantId: string;
            conversationId?: string | null;
            type: "approval" | "handoff";
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
            status?: "ok" | "error";
        }): Promise<ToolCallAuditRow>;
        listByConversation(conversationId: string): Promise<ToolCallAuditRow[]>;
    };
    prompts: {
        findActive(input: {
            tenantId: string;
            key: string;
        }): Promise<PromptTemplateRow>;
        create(input: {
            tenantId: string;
            key: string;
            content: string;
            version: number;
        }): Promise<PromptTemplateRow>;
        listVersions(input: {
            tenantId: string;
            key: string;
        }): Promise<PromptTemplateRow[]>;
    };
};
