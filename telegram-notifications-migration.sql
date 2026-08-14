-- Run once in Supabase Dashboard -> SQL Editor for an existing project.
alter table public.orders add column if not exists telegram_notified_at timestamptz;
