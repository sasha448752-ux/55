-- Manual operational rollback only; do not run as part of normal deployment.
-- Revert admin frontend separately. Keep tables and saved data intact.
begin;
drop trigger if exists record_order_status_change on public.orders;
revoke insert, update, delete on public.order_delivery from authenticated;
revoke insert, update, delete on public.order_internal_notes from authenticated;
commit;
