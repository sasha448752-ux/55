-- DEPLOYED 2026-09-17 as add_order_details_and_status_history. DO NOT REAPPLY.
-- Historical filename retained for local tests; ROLLBACK below is intentional.
-- Additive model: existing orders and their policies remain unchanged.
begin;

create table public.order_internal_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  body text not null check (length(btrim(body)) between 1 and 4000)
);
create index order_internal_notes_order_created_idx
  on public.order_internal_notes(order_id, created_at desc);
create index order_internal_notes_author_idx on public.order_internal_notes(author_id);
alter table public.order_internal_notes enable row level security;
revoke all on public.order_internal_notes from public, anon, authenticated;
grant select, insert on public.order_internal_notes to authenticated;
create policy notes_admin_read on public.order_internal_notes
  for select to authenticated using ((select private.is_admin()));
create policy notes_admin_insert on public.order_internal_notes
  for insert to authenticated with check (
    (select private.is_admin()) and author_id = (select auth.uid())
  );
-- No browser UPDATE or DELETE: corrections are appended as a new note.

create table public.order_delivery (
  order_id uuid primary key references public.orders(id) on delete cascade,
  carrier text not null default '' check (length(carrier) <= 120),
  tracking_number text not null default '' check (length(tracking_number) <= 120)
);
alter table public.order_delivery enable row level security;
revoke all on public.order_delivery from public, anon, authenticated;
grant select, insert, update on public.order_delivery to authenticated;
create policy delivery_owner_read on public.order_delivery
  for select to authenticated using (
    (select private.is_admin()) or exists (
      select 1 from public.orders o
      where o.id = order_delivery.order_id and o.customer_id = (select auth.uid())
    )
  );
create policy delivery_admin_insert on public.order_delivery
  for insert to authenticated with check ((select private.is_admin()));
create policy delivery_admin_update on public.order_delivery
  for update to authenticated using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- History is separate from internal notes; customers must never receive notes
-- through history payloads. Only trusted server code may insert history events.
create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  changed_at timestamptz not null default now(),
  previous_status text,
  new_status text not null
);
create index order_status_history_order_time_idx
  on public.order_status_history(order_id, changed_at, id);
alter table public.order_status_history enable row level security;
revoke all on public.order_status_history from public, anon, authenticated;
grant select on public.order_status_history to authenticated;
create policy history_owner_read on public.order_status_history
  for select to authenticated using (
    (select private.is_admin()) or exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id and o.customer_id = (select auth.uid())
    )
  );
-- A trigger owns append-only history. Granting INSERT to the browser would
-- allow an administrator to invent events without changing an order.
-- SECURITY DEFINER is limited to this private trigger, not a public RPC.
create function private.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;
  insert into public.order_status_history(order_id, previous_status, new_status)
  values (new.id, old.status, new.status);
  return new;
end;
$$;
revoke all on function private.record_order_status_change() from public, anon, authenticated;
create trigger record_order_status_change
after update of status on public.orders
for each row when (old.status is distinct from new.status)
execute function private.record_order_status_change();
-- No exception handler: a failed history insert aborts the status update.
-- Only signed-in admins may change status; system writes require a separately
-- authorized design, not an implicit auth.uid() IS NULL bypass.
-- 23 isolated PostgreSQL assertions passed before deployment.
-- Do not fabricate historical changes for legacy orders.
rollback;
