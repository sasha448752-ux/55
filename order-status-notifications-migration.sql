-- Run once in Supabase Dashboard -> SQL Editor for an existing project.
-- Stores the last status for which an email was successfully sent.
alter table public.orders
  add column if not exists status_email_sent_for text,
  add column if not exists status_email_sent_at timestamptz;
