# User Reply Processing Flow Diagram

This document details the lifecycle of an inbound user reply, tracing it from webhook ingestion, intent classification, prompt and context loading, to the LLM agent execution loop and final response persistence.

---

## 1. End-to-End Sequence Diagram

The following sequence diagram outlines the entire control flow across components when a message is ingested at `/api/events`.

```mermaid
sequenceDiagram
    autonumber
    actor User as Candidate (User)
    participant Webhook as Next.js API (/api/events)
    participant Ingest as ingestInboundMessage (Core)
    participant Reply as generateAndSaveReply (Core)
    participant DB as Postgres DB (database)
    participant Agent as runHrAgentScenario (Agent)
    participant LLM as OpenRouter LLM (AI Client)

    User->>Webhook: Sends message (Webhook POST)
    activate Webhook
    Webhook->>Ingest: Call ingestInboundMessage()
    activate Ingest
    Ingest->>DB: Ensure Tenant, Contact, & Conversation exist
    Ingest->>DB: Insert message (createInbound)
    Ingest-->>Webhook: Return IngestResult (stored/duplicate)
    deactivate Ingest

    alt Ingest status is duplicate
        Webhook-->>User: Return status (duplicate)
    else Ingest status is stored
        Webhook->>Reply: Call generateAndSaveReply()
        activate Reply
        Reply->>DB: Load messages list, conversation, & contact
        DB-->>Reply: Context records loaded
        Reply->>DB: Resolve default & override LLM models
        DB-->>Reply: Model settings resolved

        Note over Reply: Classify Message Intent (Chitchat vs. Agent)
        Reply->>LLM: Classify Intent (classifyIntent)
        LLM-->>Reply: Intent classification category

        alt Intent is CHITCHAT
            Reply->>LLM: Generate direct response (generateChitchatReply)
            LLM-->>Reply: Chitchat text
            Reply->>DB: Save outbound messages (createOutbound)
        else Intent is HR / Recruiting (default)
            Reply->>DB: Load active system prompt ("assistant")
            DB-->>Reply: Prompt content template
            Note over Reply: Replace placeholder variables (e.g. {{contact_name}})<br/>Append direct quoting instructions if target message exists

            Reply->>Agent: Invoke runHrAgentScenario()
            activate Agent
            Agent->>Agent: Load skills definitions & profile cache
            Agent->>Agent: Build prompt context & package tools
            
            loop Agent execution loop (maxSteps: 8)
                Agent->>LLM: Call generateText(system, prompt, tools)
                activate LLM
                LLM-->>Agent: Action (Text or Tool Call)
                deactivate LLM
                
                alt LLM output is Tool Call
                    Agent->>Agent: Execute tool locally
                    Agent->>DB: Audit log tool call & result (append)
                end
            end
            
            Agent-->>Reply: Return HrAgentRunResult (assistantText)
            deactivate Agent

            Note over Reply: Split response into message blocks (parseDraftResponses)
            loop Save response blocks
                Reply->>DB: Save outbound message (createOutbound)
            end
        end
        Reply-->>Webhook: Return saved MessageRow[]
        deactivate Reply
        Webhook-->>User: Return HTTP 200 (stored, drafts saved)
    end
    deactivate Webhook
```

---

## 2. Agent Execution and Tool-Calling Loop

When running the agent scenario (`runHrAgentScenario`), the Vercel AI SDK's `generateText` method executes a loop of tool-calling steps (up to 8 times). Each step details audit logging on completion.

```mermaid
graph TD
    A["Start runHrAgentScenario()"] --> B["Load skills (Default or Twenty)"]
    B --> C["Fetch Customer Profile Cache"]
    C --> D["Compile System Prompt & Context"]
    D --> E["Bind Agent Tools & Connect LLM"]
    E --> F["LLM Step Execution"]
    
    F --> G{"LLM Decision"}
    
    G -- "Wants to Call Tool(s)" --> H["Execute Tool(s) Locally"]
    H --> I["Fire onStepFinish callback"]
    I --> J["Append Audit log to DB<br/>(repos.audits.append)"]
    J --> K["Feed Tool Results back to LLM context"]
    K --> F
    
    G -- "Generates Final Text" --> L["End LLM loop (Stop)"]
    G -- "maxSteps (8) Reached" --> L
    
    L --> M["Return assistantText & AgentState"]
```

---

## 3. Detailed Component Breakdown

### 1. Ingestion Layer
* **Entry Point**: [api/events/route.ts](file:///Users/phuc.dang/repos/twenty/apps/admin/src/app/api/events/route.ts#L8) handles the incoming webhook post.
* **Database Mirroring**: [ingestInboundMessage](file:///Users/phuc.dang/repos/twenty/packages/core/src/ingest.ts#L30) checks the existence of required tenant, contact, and conversation containers, creating them on-demand.
* **Idempotency Protection**: A unique constraint on the database message table intercepts duplicate webhooks (returning `status: "duplicate"`).

### 2. Intent Classification
* **Classifier**: [classifyIntent](file:///Users/phuc.dang/repos/twenty/packages/agent/src/verticals/hr/intent-classifier.ts) determines whether the incoming user message constitutes a standard recruiting query or trivial chitchat (`CHITCHAT`).
* **Short-circuit**: If `CHITCHAT`, it generates a quick reply, writes it directly, and exits to avoid wasting tokens and running complex tools.

### 3. Prompt & Context Construction
* **Active Prompt Retrieval**: Loads the active template from the database via [findActive](file:///Users/phuc.dang/repos/twenty/packages/database/src/repositories/prompts.ts) (key `"assistant"`).
* **Variable Interpolation**: Replaces placeholders like `{{contact_name}}` and `{{tenant_id}}`.
* **Instruction Injection**: Appends explicit candidate-quoting instructions if the user is replying to a specific target message.

### 4. Agent Tool-Calling Loop
* **Skills Loader**: Loads relevant tools based on settings (e.g. Twenty CRM or standard mocks).
* **Runner**: [runHrAgentScenario](file:///Users/phuc.dang/repos/twenty/packages/agent/src/core/runner.ts#L51) invokes Vercel AI SDK `generateText` with up to 8 max steps.
* **Auditing**: On each completed loop step (`onStepFinish`), calls `repos.audits.append` to track the tool invocation inputs, outputs, and status.

### 5. Response Saving
* **Response Normalization**: Parses the raw agent text block or JSON list using `parseDraftResponses` in [reply.ts](file:///Users/phuc.dang/repos/twenty/packages/core/src/reply.ts#L195).
* **Database Persist**: Creates outbound rows in Postgres via `repos.messages.createOutbound` with metadata tracing back to the agent step counts.
