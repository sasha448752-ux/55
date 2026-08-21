-- Run once in Supabase Dashboard → SQL Editor.
create table public.admin_users (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.orders (
  id uuid primary key, created_at timestamptz not null default now(), full_name text not null,
  customer_id uuid references auth.users(id) on delete set null,
  phone text not null, email text, address text not null, comment text, canvas_size text not null,
  price_kop integer not null, photo_path text not null, crop_position jsonb not null default '{"x":50,"y":50}'::jsonb, telegram_notified_at timestamptz,
  status text not null default 'new' check (status in ('new','in_progress','shipped','done','cancelled'))
);
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
create schema if not exists private;
revoke all on schema private from public;
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.admin_users where user_id = (select auth.uid())) $$;
revoke all on function private.is_admin() from public;
revoke all on public.admin_users from anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
create policy "Guests create orders" on public.orders for insert to anon with check (customer_id is null);
create policy "Customers or admins create orders" on public.orders for insert to authenticated with check (customer_id is null or customer_id = (select auth.uid()) or (select private.is_admin()));
create policy "Customers or admins view orders" on public.orders for select to authenticated using (customer_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins update orders" on public.orders for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete orders" on public.orders for delete to authenticated using ((select private.is_admin()));
create index if not exists orders_customer_id_idx on public.orders (customer_id);
insert into storage.buckets (id, name, public) values ('order-photos', 'order-photos', false) on conflict (id) do nothing;
create policy "Customers upload photos" on storage.objects for insert to anon, authenticated with check (bucket_id = 'order-photos' and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "Admins view photos" on storage.objects for select to authenticated using (bucket_id = 'order-photos' and (select private.is_admin()));
-- Create an admin in Dashboard → Authentication → Users, then run:
-- insert into public.admin_users (user_id) values ('PASTE_THE_USER_UUID_HERE');
