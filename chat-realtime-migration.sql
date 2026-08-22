create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_token uuid not null unique,
  visitor_name text,
  visitor_contact text,
  last_message text,
  last_sender text check (last_sender in ('visitor', 'admin')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'admin')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_at_idx
  on public.chat_messages (conversation_id, created_at);
create index if not exists chat_conversations_last_message_at_idx
  on public.chat_conversations (last_message_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

-- The browser never reads these tables directly. Both visitor and administrator
-- access go through Edge Functions, which apply their own token/auth checks.
revoke all on table public.chat_conversations from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
