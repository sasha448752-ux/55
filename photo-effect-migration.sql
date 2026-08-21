-- Run once for an existing CANVASO Supabase project.
alter table public.orders
  add column if not exists photo_effect text not null default 'none'
  check (photo_effect in ('none', 'black_white', 'warm', 'vintage', 'contrast'));
