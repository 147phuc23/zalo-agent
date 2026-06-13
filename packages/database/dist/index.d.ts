export type { Database } from "./generated/database.js";
export { createAuditRepository, createContactRepository, createConversationRepository, createDeliveryRepository, createHumanTaskRepository, createMessageRepository, createRepositorySet, createTenantRepository, createWorkflowConfigRepository, type DatabaseClient, } from "./repositories.js";
export declare function createDatabaseClient(input: {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
}): import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
