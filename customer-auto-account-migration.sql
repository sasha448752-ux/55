-- Run once for an existing CANVASO Supabase project.
-- The token is known only to the customer checkout session and lets the
-- server safely connect a newly invited account to its just-created order.
alter table public.orders
  add column if not exists account_claim_token uuid unique;
