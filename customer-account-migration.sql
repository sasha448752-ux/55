-- Run this once in Supabase Dashboard → SQL Editor after supabase-setup.sql.
-- It links orders made by signed-in customers to their own account.
alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;

drop policy if exists "Customers view own orders" on public.orders;
create policy "Customers view own orders" on public.orders
  for select to authenticated using (customer_id = auth.uid());

drop policy if exists "Anyone can create an order" on public.orders;
create policy "Guests create orders" on public.orders
  for insert to anon with check (customer_id is null);
create policy "Customers create own orders" on public.orders
  for insert to authenticated with check (customer_id is null or customer_id = auth.uid());
