# Autonomous Recruiting System Goals

This document outlines the strategic vision for evolving the current single HR agent into a fully autonomous, multi-agent recruiting ecosystem.

## 1. Multi-Agent Routing & Token Optimization

**Current State**: A single heavy agent processes every incoming Zalo message, consuming tokens even for simple greetings like "Hi".
**Goal**: Implement a **Router & Chitchat Agent**.
- **How it works**: Use a very fast, cheap model (e.g., Llama 3 8B or Haiku) as the frontline router. 
- **Responsibility**: It handles casual chitchat, greetings, and basic FAQs. It constantly evaluates the user's intent.
- **Handoff**: As soon as the candidate uploads a CV or expresses clear intent to find a job, the Router hands off the conversation (and context) to the heavy **HR Specialist Agent** (the one we've been optimizing) to execute tools and CRM lookups.

## 2. CV Processing Pipeline

We need dedicated backend agents to handle asynchronous file processing.

- **CV Extraction Agent**:
  - Triggered automatically when a PDF/Docx is uploaded via Zalo.
  - Extracts structured ATS data: Skills, Experience (Years), Education, Contact Info, and Previous Companies.
  - Uses specialized vision/document models (like Claude 3.5 Sonnet or Document AI) to accurately parse complex resume layouts.
  - Automatically updates the candidate's profile in the Twenty CRM.

- **Ranking & Matching Agent**:
  - Runs in the background once a candidate's profile is updated.
  - Computes a "Match Score" against all `OPEN` job postings using vector embeddings (skills matching) and hard filters (salary/location).
  - Flags the candidate in the CRM as a "Strong Match" for specific roles.

## 3. Autonomous Outreach & Nurturing (The "Recruiter Engine")

Move from a purely *reactive* bot to a *proactive* autonomous system.

### A. Automated Pipeline Follow-ups
- **Goal**: Never leave a candidate hanging.
- **Execution**: A daily cron job queries the CRM for candidates who have been in `INTERVIEWING` or `SCREENING` stages for more than X days without an update.
- **Action**: An agent drafts and sends a polite follow-up via Zalo: *"Hi [Name], I'm still waiting on feedback from the hiring manager for the [Role] position. I'll let you know as soon as I have an update! 😊"*

### B. Proactive Job Pushing (Reverse Matching)
- **Goal**: Re-engage passive candidates in the database when new jobs open.
- **Execution**: When an HR Admin creates a new Job Posting in the CRM, a background event is triggered.
- **Action**: 
  1. The **Matching Agent** scans the entire CRM database for candidates with high match scores (>85%) for the new role.
  2. For matched candidates who aren't currently interviewing, the **Outreach Agent** sends a personalized Zalo message: 
     *"Hi [Name], based on your background in [Skill], I thought you might be interested in a new [Role] position that just opened up at [Company]. Would you like me to send you the details?"*

### C. Priority / Urgent Job Campaigns
- **Goal**: Rapidly source candidates for high-priority or urgent roles (often offering premium pay).
- **Execution**: When a job is tagged as `URGENT` or `HIGH PRIORITY` in the CRM, a dedicated campaign agent takes over.
- **Action**: 
  1. The agent relaxes some strict matching criteria to widen the talent pool.
  2. It reaches out to passive candidates with a slightly more urgent and enticing message, emphasizing the higher pay and fast-tracked interview process:
     *"Hi [Name]! We have an urgent opening for a [Role] at [Company] with a highly competitive salary range. Since it's a priority role, they are fast-tracking interviews this week. Given your experience, I'd love to put your profile forward. Are you open to a quick chat?"*

---

## 4. System Architecture & Mode Implementation

The core messaging pipeline is built on **Redis** and **BullMQ** to ensure asynchronous, fault-tolerant execution. The worker evaluates the "mode" of each tenant's workflow to decide whether to dispatch an agent or create a human task.

### Core Dependencies
- **Redis (ioredis)**: Used for pub/sub (SSE event broadcasting) and caching session contexts.
- **BullMQ**: Manages the message queues (`message.received` and `message.send`) with built-in retry logic and debouncing.

### Operational Modes

The `resolveMode()` function queries the database to determine how a message should be handled. We currently support four distinct operational modes:

1. **`auto` (Fully Autonomous)**
   - The message skips human review.
   - An `AbortController` is attached. If consecutive messages arrive within 10 seconds, the previous job is aborted and debounced.
   - The worker runs the **HR Agent Scenario** (`generateDraftReply`), passing the message history to the LLM (e.g., OpenRouter).
   - Once the draft is generated, it immediately queues the response via the `message.send` BullMQ queue.

2. **`approval` (Human in the Loop - Copilot)**
   - Used for higher-risk workflows or when the AI confidence is low.
   - Instead of sending the message automatically, the worker creates a `human_tasks` database record with type `"approval"`.
   - The HR Admin reviews the AI-generated draft in the UI and manually approves or edits it before dispatching to the `message.send` queue.

3. **`manual` (Traditional Inbox)**
   - The AI is completely disabled for responses.
   - The worker routes the incoming message straight to the inbox and creates an `"approval"` (review) task tagged as `manual-policy`.
   - A human recruiter must type the reply from scratch.

4. **`blocked` (Policy Violation)**
   - If a candidate matches a blocked topic (e.g., "legal dispute" or "refund request"), the AI aborts processing.
   - A human task of type `"handoff"` is created with the reason `blocked-by-policy`, escalating the thread directly to a senior recruiter or support staff.

> [!NOTE]
> Future autonomous agents (like the CV Parser or Priority Job Campaign) will run as separate BullMQ Workers listening on their own dedicated queues (e.g., `cv.uploaded` or `job.priority.created`).
