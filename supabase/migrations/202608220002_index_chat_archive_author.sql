create index if not exists chat_conversations_archived_by_idx
  on public.chat_conversations (archived_by);
