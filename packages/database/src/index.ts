import { createClient } from "@supabase/supabase-js";
export type { Database } from "./generated/database.js";
export {
  createAuditRepository,
  createContactRepository,
  createConversationRepository,
  createDeliveryRepository,
  createHumanTaskRepository,
  createMessageRepository,
  createRepositorySet,
  createTenantRepository,
  createWorkflowConfigRepository,
  type DatabaseClient,
} from "./repositories.js";

export function createDatabaseClient(input: {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}) {
  return createClient(
    input.SUPABASE_URL,
    input.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false },
    },
  );
}
