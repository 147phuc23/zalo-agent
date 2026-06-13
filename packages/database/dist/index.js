import { createClient } from "@supabase/supabase-js";
export { createAuditRepository, createContactRepository, createConversationRepository, createDeliveryRepository, createHumanTaskRepository, createMessageRepository, createRepositorySet, createTenantRepository, createWorkflowConfigRepository, } from "./repositories.js";
export function createDatabaseClient(input) {
    return createClient(input.SUPABASE_URL, input.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });
}
