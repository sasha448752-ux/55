-- Run only to roll back the price guard. Does not delete or alter order data.
begin;
set local lock_timeout = '5s';
drop trigger if exists validate_new_canvas_price on public.orders;
drop function if exists private.validate_new_canvas_price();
commit;
