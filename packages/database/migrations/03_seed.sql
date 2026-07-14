create extension if not exists "pgcrypto";
create extension if not exists "vector";

insert into public.tenants (id, name, timezone, locale, status)
values
  ('11111111-1111-1111-1111-111111111111', 'sales-demo', 'Asia/Ho_Chi_Minh', 'vi-VN', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'support-demo', 'Asia/Ho_Chi_Minh', 'vi-VN', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'booking-demo', 'Asia/Ho_Chi_Minh', 'vi-VN', 'active');

insert into public.users (id, email, display_name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@sales-demo.local', 'Sales Admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'agent@support-demo.local', 'Support Agent'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'viewer@booking-demo.local', 'Booking Viewer');

insert into public.tenant_users (tenant_id, user_id, role)
values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'agent'),
  ('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'viewer');

insert into public.channel_accounts (
  tenant_id,
  channel,
  external_account_id,
  status,
  encrypted_session_blob,
  last_seen_at
)
values
  ('11111111-1111-1111-1111-111111111111', 'zalo', 'zalo-sales-demo', 'active', null, '2026-04-30T09:00:00+07:00'),
  ('22222222-2222-2222-2222-222222222222', 'zalo', 'zalo-support-demo', 'active', null, '2026-04-30T09:30:00+07:00'),
  ('33333333-3333-3333-3333-333333333333', 'zalo', 'zalo-booking-demo', 'active', null, '2026-04-30T10:00:00+07:00');

insert into public.workflow_configs (
  tenant_id,
  mode,
  default_model,
  classifier_model,
  embedding_model,
  max_tool_turns,
  temperature,
  prompt_settings,
  crm_mapping,
  blocked_topics
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'auto',
    'tencent/hy3:free',
    'tencent/hy3:free',
    'text-embedding-3-small',
    6,
    0.2,
    '{"tone":"confident","style":"sales"}'::jsonb,
    '{"person_system":"twenty"}'::jsonb,
    '["legal","billing dispute"]'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'approval',
    'tencent/hy3:free',
    'tencent/hy3:free',
    'text-embedding-3-small',
    4,
    0.15,
    '{"tone":"calm","style":"support"}'::jsonb,
    '{"person_system":"twenty"}'::jsonb,
    '["security incident","refund"]'::jsonb
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'manual',
    'tencent/hy3:free',
    'tencent/hy3:free',
    'text-embedding-3-small',
    5,
    0.1,
    '{"tone":"warm","style":"booking"}'::jsonb,
    '{"person_system":"twenty"}'::jsonb,
    '["urgent cancellation","VIP escalation"]'::jsonb
  );

insert into public.contacts (
  tenant_id,
  channel,
  external_user_id,
  display_name,
  phone,
  metadata
)
select
  spec.tenant_id,
  'zalo',
  spec.external_user_id,
  spec.display_name,
  spec.phone,
  spec.metadata
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'sales-contact-1', 'An Nguyen', '+84901000001', '{"topic":"product demo"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'sales-contact-2', 'Binh Tran', '+84901000002', '{"topic":"pricing follow-up"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'sales-contact-3', 'Chi Le', '+84901000003', '{"topic":"enterprise rollout"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'sales-contact-4', 'Dung Pham', '+84901000004', '{"topic":"security review"}'::jsonb),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'sales-contact-5', 'Hanh Vo', '+84901000005', '{"topic":"trial extension"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'support-contact-1', 'Linh Nguyen', '+84902000001', '{"topic":"login issue"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'support-contact-2', 'Mai Tran', '+84902000002', '{"topic":"payment retry"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'support-contact-3', 'Nam Le', '+84902000003', '{"topic":"message sync"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'support-contact-4', 'Oanh Pham', '+84902000004', '{"topic":"stuck approval"}'::jsonb),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'support-contact-5', 'Phuc Vo', '+84902000005', '{"topic":"connector session"}'::jsonb),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'booking-contact-1', 'Quyen Nguyen', '+84903000001', '{"topic":"meeting request"}'::jsonb),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'booking-contact-2', 'Son Tran', '+84903000002', '{"topic":"availability check"}'::jsonb),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'booking-contact-3', 'Trang Le', '+84903000003', '{"topic":"schedule change"}'::jsonb),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'booking-contact-4', 'Vy Pham', '+84903000004', '{"topic":"confirmation note"}'::jsonb),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'booking-contact-5', 'Yen Vo', '+84903000005', '{"topic":"deposit reminder"}'::jsonb)
) as spec(tenant_id, external_user_id, display_name, phone, metadata);

insert into public.conversations (
  tenant_id,
  channel,
  external_thread_id,
  contact_id,
  status,
  assignee_user_id,
  last_activity_at
)
select
  c.tenant_id,
  c.channel,
  c.external_thread_id,
  contact.id,
  c.status,
  c.assignee_user_id,
  c.last_activity_at
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'zalo', 'sales-thread-1', 'sales-contact-1', 'open', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '2026-04-29T10:00:00+07:00'::timestamptz),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'zalo', 'sales-thread-2', 'sales-contact-2', 'pending', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '2026-04-29T11:00:00+07:00'::timestamptz),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'zalo', 'sales-thread-3', 'sales-contact-3', 'open', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '2026-04-29T12:00:00+07:00'::timestamptz),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'zalo', 'sales-thread-4', 'sales-contact-4', 'open', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '2026-04-29T13:00:00+07:00'::timestamptz),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'zalo', 'sales-thread-5', 'sales-contact-5', 'closed', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '2026-04-29T14:00:00+07:00'::timestamptz),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'zalo', 'support-thread-1', 'support-contact-1', 'open', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '2026-04-29T09:00:00+07:00'::timestamptz),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'zalo', 'support-thread-2', 'support-contact-2', 'pending', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '2026-04-29T10:00:00+07:00'::timestamptz),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'zalo', 'support-thread-3', 'support-contact-3', 'open', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '2026-04-29T11:00:00+07:00'::timestamptz),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'zalo', 'support-thread-4', 'support-contact-4', 'open', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '2026-04-29T12:00:00+07:00'::timestamptz),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'zalo', 'support-thread-5', 'support-contact-5', 'closed', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '2026-04-29T13:00:00+07:00'::timestamptz),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'zalo', 'booking-thread-1', 'booking-contact-1', 'open', null, '2026-04-29T08:00:00+07:00'::timestamptz),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'zalo', 'booking-thread-2', 'booking-contact-2', 'pending', null, '2026-04-29T09:00:00+07:00'::timestamptz),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'zalo', 'booking-thread-3', 'booking-contact-3', 'open', null, '2026-04-29T10:00:00+07:00'::timestamptz),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'zalo', 'booking-thread-4', 'booking-contact-4', 'open', null, '2026-04-29T11:00:00+07:00'::timestamptz),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'zalo', 'booking-thread-5', 'booking-contact-5', 'closed', null, '2026-04-29T12:00:00+07:00'::timestamptz)
) as c(tenant_id, channel, external_thread_id, external_user_id, status, assignee_user_id, last_activity_at)
join public.contacts as contact
  on contact.tenant_id = c.tenant_id
 and contact.channel = c.channel
 and contact.external_user_id = c.external_user_id;

insert into public.messages (
  tenant_id,
  conversation_id,
  direction,
  message_type,
  text,
  external_message_id,
  idempotency_key,
  raw_payload,
  created_at
)
select
  convo.tenant_id,
  convo.id,
  msg.direction,
  msg.message_type,
  msg.text,
  msg.external_message_id,
  msg.idempotency_key,
  msg.raw_payload,
  msg.created_at
from public.conversations as convo
join public.contacts as contact
  on contact.id = convo.contact_id
cross join lateral (
  values
    (
      'inbound',
      'text',
      format('Xin chào, mình cần hỗ trợ về %s.', contact.metadata->>'topic'),
      format('%s-inbound', convo.external_thread_id),
      format('demo:%s:%s:inbound', convo.external_thread_id, contact.external_user_id),
      jsonb_build_object('source', 'seed', 'step', 'inbound'),
      convo.last_activity_at - interval '1 hour'
    ),
    (
      'outbound',
      'text',
      format('Cảm ơn bạn, mình đã ghi nhận yêu cầu về %s.', contact.metadata->>'topic'),
      format('%s-outbound', convo.external_thread_id),
      format('demo:%s:%s:outbound', convo.external_thread_id, contact.external_user_id),
      jsonb_build_object('source', 'seed', 'step', 'outbound'),
      convo.last_activity_at
    )
) as msg(direction, message_type, text, external_message_id, idempotency_key, raw_payload, created_at);

insert into public.message_deliveries (
  tenant_id,
  message_id,
  attempt,
  status,
  error_code,
  error_message,
  provider_payload
)
select
  message.tenant_id,
  message.id,
  1,
  case when message.direction = 'outbound' then 'delivered' else 'skipped' end,
  null,
  null,
  jsonb_build_object('source', 'seed')
from public.messages as message
where message.direction = 'outbound';

insert into public.tool_call_audits (
  tenant_id,
  conversation_id,
  run_id,
  tool_name,
  input,
  output,
  status
)
select
  convo.tenant_id,
  convo.id,
  format('seed-run-%s', row_number() over (order by convo.created_at)),
  'db.getConversation',
  jsonb_build_object('conversationId', convo.id),
  jsonb_build_object('ok', true),
  'ok'
from public.conversations as convo
where convo.status <> 'closed';

insert into public.human_tasks (
  tenant_id,
  conversation_id,
  type,
  status,
  payload
)
select
  convo.tenant_id,
  convo.id,
  case when convo.status = 'pending' then 'approval' else 'handoff' end,
  'open',
  jsonb_build_object('reason', 'seed-demo', 'conversationId', convo.id)
from public.conversations as convo
where convo.status in ('pending', 'open');

with docs as (
  insert into public.knowledge_documents (
    tenant_id,
    source_type,
    title,
    content,
    metadata
  )
  values
    (
      '11111111-1111-1111-1111-111111111111',
      'seed-guide',
      'Sales playbook',
      'How the sales team qualifies, follows up, and closes leads.',
      '{"audience":"sales"}'::jsonb
    ),
    (
      '11111111-1111-1111-1111-111111111111',
      'seed-guide',
      'ROI calculator',
      'Pricing guidance and ROI framing for decision makers.',
      '{"audience":"sales"}'::jsonb
    ),
    (
      '22222222-2222-2222-2222-222222222222',
      'seed-guide',
      'Support macros',
      'A small library of replies for common support cases.',
      '{"audience":"support"}'::jsonb
    ),
    (
      '22222222-2222-2222-2222-222222222222',
      'seed-guide',
      'Connector troubleshooting',
      'How to recover from expired sessions and retry failed posts.',
      '{"audience":"support"}'::jsonb
    ),
    (
      '33333333-3333-3333-3333-333333333333',
      'seed-guide',
      'Booking FAQ',
      'Common booking questions and answers.',
      '{"audience":"booking"}'::jsonb
    ),
    (
      '33333333-3333-3333-3333-333333333333',
      'seed-guide',
      'Cancellation policy',
      'Booking changes, cancellation steps, and deadlines.',
      '{"audience":"booking"}'::jsonb
    )
  returning id, tenant_id, title
)
insert into public.knowledge_chunks (
  tenant_id,
  document_id,
  chunk_index,
  content,
  embedding,
  metadata
)
select
  docs.tenant_id,
  docs.id,
  chunk_idx,
  format('%s — chunk %s for demo retrieval.', docs.title, chunk_idx),
  null,
  jsonb_build_object('title', docs.title, 'chunkIndex', chunk_idx)
from docs
cross join generate_series(1, 3) as chunk_idx;

insert into public.external_refs (
  tenant_id,
  system,
  local_id,
  remote_id,
  remote_type,
  unique_key_hash
)
select
  convo.tenant_id,
  'twenty',
  null,
  format('%s-person', convo.external_thread_id),
  'person',
  md5(format('%s:person:%s', convo.tenant_id, convo.external_thread_id))
from public.conversations as convo;

-- Seed default prompt templates
insert into public.prompt_templates (tenant_id, key, content, version, is_active)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'assistant',
    '# HR Chat Agent Responsibility
You are an HR recruiter chat agent for Zalo conversations.
Reply in Vietnamese unless the candidate writes in English.
Your job is to gather candidate requirements, avoid asking for known CRM details, search matching jobs when enough information exists, and save interaction state/history through skills.

Always use skills for CRM/profile lookup, requirement updates, job search, memory, and history when relevant.
Use CRM profile write skills when the candidate shares durable profile facts or recruiter notes. Use requirement skills for temporary job-search criteria.
Ask at most one focused follow-up question when important requirement fields are missing.

Strictly follow a message-by-message response style like a human chatting on a messaging app.
Keep each message extremely short, natural, and concise (ideally 1-2 short sentences per message bubble).
Break your thoughts into sequential, realistic chat replies separated by double newlines (\n\n), instead of combining everything into a single long paragraph.
Add appropriate friendly icons/emojis (e.g., 😊, 👍, ✨) to make the chat engaging and friendly.
Do not write one very long paragraph; instead, use double newlines (\n\n) to separate the response into a list of concise chat replies.

When listing or recommending jobs, do NOT use markdown bold formatting (like **Job Title**). Use plain text.
Do NOT use numbered list emojis (like 1️⃣, 2️⃣) or shopping/cart emojis (like 🛒) when presenting jobs. Write in a natural, human-like conversational style.',
    1,
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'assistant',
    '# HR Chat Agent Responsibility
You are an HR recruiter chat agent for Zalo conversations.
Reply in Vietnamese unless the candidate writes in English.
Your job is to gather candidate requirements, avoid asking for known CRM details, search matching jobs when enough information exists, and save interaction state/history through skills.

Always use skills for CRM/profile lookup, requirement updates, job search, memory, and history when relevant.
Use CRM profile write skills when the candidate shares durable profile facts or recruiter notes. Use requirement skills for temporary job-search criteria.
Ask at most one focused follow-up question when important requirement fields are missing.

Strictly follow a message-by-message response style like a human chatting on a messaging app.
Keep each message extremely short, natural, and concise (ideally 1-2 short sentences per message bubble).
Break your thoughts into sequential, realistic chat replies separated by double newlines (\n\n), instead of combining everything into a single long paragraph.
Add appropriate friendly icons/emojis (e.g., 😊, 👍, ✨) to make the chat engaging and friendly.
Do not write one very long paragraph; instead, use double newlines (\n\n) to separate the response into a list of concise chat replies.

When listing or recommending jobs, do NOT use markdown bold formatting (like **Job Title**). Use plain text.
Do NOT use numbered list emojis (like 1️⃣, 2️⃣) or shopping/cart emojis (like 🛒) when presenting jobs. Write in a natural, human-like conversational style.',
    1,
    true
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'assistant',
    '# HR Chat Agent Responsibility
You are an HR recruiter chat agent for Zalo conversations.
Reply in Vietnamese unless the candidate writes in English.
Your job is to gather candidate requirements, avoid asking for known CRM details, search matching jobs when enough information exists, and save interaction state/history through skills.

Always use skills for CRM/profile lookup, requirement updates, job search, memory, and history when relevant.
Use CRM profile write skills when the candidate shares durable profile facts or recruiter notes. Use requirement skills for temporary job-search criteria.
Ask at most one focused follow-up question when important requirement fields are missing.

Strictly follow a message-by-message response style like a human chatting on a messaging app.
Keep each message extremely short, natural, and concise (ideally 1-2 short sentences per message bubble).
Break your thoughts into sequential, realistic chat replies separated by double newlines (\n\n), instead of combining everything into a single long paragraph.
Add appropriate friendly icons/emojis (e.g., 😊, 👍, ✨) to make the chat engaging and friendly.
Do not write one very long paragraph; instead, use double newlines (\n\n) to separate the response into a list of concise chat replies.

When listing or recommending jobs, do NOT use markdown bold formatting (like **Job Title**). Use plain text.
Do NOT use numbered list emojis (like 1️⃣, 2️⃣) or shopping/cart emojis (like 🛒) when presenting jobs. Write in a natural, human-like conversational style.',
    1,
    true
  )
on conflict (tenant_id, key, version) do nothing;
