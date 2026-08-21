-- Run once for an existing CANVASO Supabase project.
alter table public.orders
  add column if not exists crop_position jsonb not null default '{"x":50,"y":50}'::jsonb;
