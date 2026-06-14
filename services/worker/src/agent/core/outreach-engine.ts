import { Queue, Worker } from "bullmq";
import { OpenRouterAiClient } from "@platform/ai-client";
import { createTwentyRecruitingClientFromEnv } from "../twenty/recruiting-client.js";
import type { JobPosting } from "../types.js";

const FOLLOWUP_SYSTEM_PROMPT = `You are a polite, helpful HR recruiting assistant.
Draft a polite check-in message to follow up on the candidate's application status.
Acknowledge that we are still waiting for feedback from the hiring manager or the team, and assure them we will update them as soon as we hear back.
Keep the message short, warm, and natural (1-2 sentences maximum).
Reply in Vietnamese with friendly emojis.`;

const REVERSE_MATCH_SYSTEM_PROMPT = `You are a friendly HR recruiting recruiter.
Write a brief, personalized outreach message to a passive candidate in our database, proposing a new job posting that highly matches their skills.
Highlight the job title and company. Ask if they are open to receiving more details or discussing it.
Keep the message extremely short and natural (1-2 sentences maximum).
Reply in Vietnamese with friendly emojis.`;

const URGENT_CAMPAIGN_SYSTEM_PROMPT = `You are a proactive recruiting headhunter.
Write an urgent outreach message to a candidate for a high-priority, urgent job opening that matches their background.
Emphasize that the role is urgent, offers competitive compensation, and has a fast-tracked interview process this week.
Keep the message concise, highly engaging, and natural (1-2 sentences maximum).
Reply in Vietnamese with friendly emojis.`;

export async function generateFollowUpMessage(
  candidateName: string,
  roleName: string,
  model: string = "openrouter/owl-alpha",
): Promise<string> {
  const client = new OpenRouterAiClient();
  const response = await client.generate({
    model,
    system: FOLLOWUP_SYSTEM_PROMPT,
    prompt: `Candidate name: ${candidateName}\nJob role: ${roleName}`,
    temperature: 0.7,
  });
  return response.text;
}

export async function generateJobOutreachMessage(
  candidateName: string,
  jobTitle: string,
  company: string,
  model: string = "openrouter/owl-alpha",
): Promise<string> {
  const client = new OpenRouterAiClient();
  const response = await client.generate({
    model,
    system: REVERSE_MATCH_SYSTEM_PROMPT,
    prompt: `Candidate name: ${candidateName}\nNew Job: ${jobTitle} at ${company}`,
    temperature: 0.7,
  });
  return response.text;
}

export async function generateUrgentOutreachMessage(
  candidateName: string,
  jobTitle: string,
  company: string,
  model: string = "openrouter/owl-alpha",
): Promise<string> {
  const client = new OpenRouterAiClient();
  const response = await client.generate({
    model,
    system: URGENT_CAMPAIGN_SYSTEM_PROMPT,
    prompt: `Candidate name: ${candidateName}\nUrgent Job: ${jobTitle} at ${company}`,
    temperature: 0.7,
  });
  return response.text;
}

export async function runPipelineFollowUpsCampaign(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisPublisher: any;
  messageSendQueue: Queue;
}): Promise<number> {
  console.log("[outreach-engine] Running Pipeline Follow-ups Campaign...");
  const recruitingClient = createTwentyRecruitingClientFromEnv();

  // 1. Fetch conversations that are open
  const res = await input.db.query(
    `SELECT c.id, c.tenant_id, c.external_thread_id, c.contact_id, c.last_activity_at 
     FROM conversations c 
     WHERE c.status = 'open'`
  );
  
  let processedCount = 0;

  for (const conv of res.rows) {
    const contactList = await input.repos.contacts.listByIds({ ids: [conv.contact_id] });
    const contact = contactList[0];
    if (!contact) continue;

    const externalUserId = contact.external_user_id;

    // 2. Query candidates stuck in Screening/Interviewing from CRM
    const crmStatus = await recruitingClient.getCandidateRecruitingStatus({ externalUserId });
    
    if (crmStatus.personFound && (crmStatus.pipelineStage === "screening" || crmStatus.pipelineStage === "interviewing")) {
      // Find the applications to get the role name
      const apps = await recruitingClient.listInProgressApplications({ externalUserId });
      const activeApp = apps[0];
      const jobTitle = activeApp?.job?.title || "vị trí đang tuyển";
      const displayName = contact.display_name || "bạn";

      // Generate outreach draft
      const followUpText = await generateFollowUpMessage(displayName, jobTitle);

      // Send the Zalo message
      await sendOutboundMessage({
        tenantId: conv.tenant_id,
        conversationId: conv.id,
        threadId: conv.external_thread_id,
        text: followUpText,
        kind: "followup_campaign",
        repos: input.repos,
        redisPublisher: input.redisPublisher,
        messageSendQueue: input.messageSendQueue,
      });

      processedCount++;
    }
  }

  return processedCount;
}

export async function runReverseMatchingCampaign(input: {
  job: JobPosting;
  tenantId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisPublisher: any;
  messageSendQueue: Queue;
}): Promise<number> {
  console.log(`[outreach-engine] Running Reverse Matching Campaign for job "${input.job.title}" at "${input.job.company}"...`);
  const recruitingClient = createTwentyRecruitingClientFromEnv();

  // Fetch all contacts/candidates in our tenant
  const res = await input.db.query(
    `SELECT c.id, c.external_user_id, c.display_name 
     FROM contacts c 
     WHERE c.tenant_id = $1`,
    [input.tenantId]
  );

  let outreachCount = 0;

  for (const contactRow of res.rows) {
    const externalUserId = contactRow.external_user_id;

    // Load candidate CRM profile and compute matching score
    const profile = await recruitingClient.loadCandidateProfile({ externalUserId });
    const matchScores = await recruitingClient.computeJobMatchScores({ profile, jobs: [input.job] });
    const match = matchScores[0];

    // High match score (> 8) triggers outreach
    if (match && match.score >= 8) {
      const candidateName = contactRow.display_name || "bạn";
      const messageText = await generateJobOutreachMessage(candidateName, input.job.title, input.job.company);

      // Find an active conversation to send message to
      const convRes = await input.db.query(
        `SELECT id, external_thread_id FROM conversations WHERE contact_id = $1 LIMIT 1`,
        [contactRow.id]
      );
      const conv = convRes.rows[0];
      if (!conv) continue;

      await sendOutboundMessage({
        tenantId: input.tenantId,
        conversationId: conv.id,
        threadId: conv.external_thread_id,
        text: messageText,
        kind: "reverse_match_campaign",
        repos: input.repos,
        redisPublisher: input.redisPublisher,
        messageSendQueue: input.messageSendQueue,
      });

      outreachCount++;
    }
  }

  return outreachCount;
}

export async function runUrgentJobCampaign(input: {
  job: JobPosting;
  tenantId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisPublisher: any;
  messageSendQueue: Queue;
}): Promise<number> {
  console.log(`[outreach-engine] Running Urgent Campaign for high-priority job "${input.job.title}"...`);
  const recruitingClient = createTwentyRecruitingClientFromEnv();

  const res = await input.db.query(
    `SELECT c.id, c.external_user_id, c.display_name 
     FROM contacts c 
     WHERE c.tenant_id = $1`,
    [input.tenantId]
  );

  let outreachCount = 0;

  for (const contactRow of res.rows) {
    const externalUserId = contactRow.external_user_id;
    const profile = await recruitingClient.loadCandidateProfile({ externalUserId });
    
    // For urgent jobs, relax matching criteria (score >= 6)
    const matchScores = await recruitingClient.computeJobMatchScores({ profile, jobs: [input.job] });
    const match = matchScores[0];

    if (match && match.score >= 6) {
      const candidateName = contactRow.display_name || "bạn";
      const messageText = await generateUrgentOutreachMessage(candidateName, input.job.title, input.job.company);

      const convRes = await input.db.query(
        `SELECT id, external_thread_id FROM conversations WHERE contact_id = $1 LIMIT 1`,
        [contactRow.id]
      );
      const conv = convRes.rows[0];
      if (!conv) continue;

      await sendOutboundMessage({
        tenantId: input.tenantId,
        conversationId: conv.id,
        threadId: conv.external_thread_id,
        text: messageText,
        kind: "urgent_campaign",
        repos: input.repos,
        redisPublisher: input.redisPublisher,
        messageSendQueue: input.messageSendQueue,
      });

      outreachCount++;
    }
  }

  return outreachCount;
}

async function sendOutboundMessage(input: {
  tenantId: string;
  conversationId: string;
  threadId: string;
  text: string;
  kind: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisPublisher: any;
  messageSendQueue: Queue;
}) {
  const batchId = `${input.kind}:${input.tenantId}:${input.conversationId}:${Date.now()}`;
  const idempotencyKey = `${batchId}:1`;

  const msgRow = await input.repos.messages.createOutbound({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    messageType: "text",
    text: input.text,
    externalMessageId: null,
    idempotencyKey,
    rawPayload: { kind: input.kind },
  });

  await input.redisPublisher.publish(
    "platform:sse",
    JSON.stringify({
      type: "message_created",
      payload: {
        conversationId: input.conversationId,
        message: {
          id: msgRow.id,
          tenantId: msgRow.tenant_id,
          conversationId: msgRow.conversation_id,
          direction: msgRow.direction,
          messageType: msgRow.message_type,
          text: msgRow.text,
          externalMessageId: msgRow.external_message_id,
          idempotencyKey: msgRow.idempotency_key,
          isRead: msgRow.is_read,
          readAt: msgRow.read_at ? new Date(msgRow.read_at).toISOString() : null,
          createdAt: new Date(msgRow.created_at).toISOString(),
        },
      },
    })
  );

  const sendJobId = idempotencyKey.replaceAll(":", "_");
  await input.messageSendQueue.add(
    "message.send",
    {
      tenantId: input.tenantId,
      channel: "zalo",
      threadId: input.threadId,
      text: input.text,
      idempotencyKey,
    },
    { jobId: sendJobId }
  );
}

export function startOutreachCampaignWorkers(input: {
  redisUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  repos: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisPublisher: any;
  messageSendQueue: Queue;
}): { followupWorker: Worker; campaignWorker: Worker } {
  // 1. Follow-ups Queue Worker
  const followupWorker = new Worker(
    "outreach.followup",
    async (job) => {
      console.log(`[outreach-worker] Running pipeline followups trigger job ${job.id}`);
      const count = await runPipelineFollowUpsCampaign({
        db: input.db,
        repos: input.repos,
        redisPublisher: input.redisPublisher,
        messageSendQueue: input.messageSendQueue,
      });
      return { ok: true, processedCount: count };
    },
    { connection: { url: input.redisUrl } }
  );

  // 2. Job Campaign Queue Worker (for new jobs & urgent job pushing)
  const campaignWorker = new Worker(
    "outreach.campaign",
    async (job) => {
      const data = job.data as {
        job: JobPosting;
        tenantId: string;
        campaignType: "reverse_match" | "urgent";
      };
      
      console.log(`[outreach-worker] Running job campaign job ${job.id} type ${data.campaignType}`);
      
      let count = 0;
      if (data.campaignType === "urgent") {
        count = await runUrgentJobCampaign({
          job: data.job,
          tenantId: data.tenantId,
          db: input.db,
          repos: input.repos,
          redisPublisher: input.redisPublisher,
          messageSendQueue: input.messageSendQueue,
        });
      } else {
        count = await runReverseMatchingCampaign({
          job: data.job,
          tenantId: data.tenantId,
          db: input.db,
          repos: input.repos,
          redisPublisher: input.redisPublisher,
          messageSendQueue: input.messageSendQueue,
        });
      }

      return { ok: true, outreachCount: count };
    },
    { connection: { url: input.redisUrl } }
  );

  return { followupWorker, campaignWorker };
}
