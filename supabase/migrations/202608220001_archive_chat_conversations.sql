alter table public.chat_conversations
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id);

create index if not exists chat_conversations_archived_last_message_idx
  on public.chat_conversations (archived_at, last_message_at desc);
