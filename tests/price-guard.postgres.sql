begin;
create temporary table canvas_price_test(canvas_size text, price_kop integer, status text default 'new');
insert into canvas_price_test values ('legacy size', 123, 'new');
-- DRAFT, NOT DEPLOYED. Convert to a CLI-generated migration after staging tests.
-- Only validates INSERT; existing prices and status updates remain untouched.
-- No elevated privileges, reads of customer data, or changes to RLS.
create function pg_temp.validate_new_canvas_price()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected integer;
begin
  select p.price_kop into expected
  from (values
    ('20 × 20 см', 99000),
    ('30 × 20 см', 119000), ('20 × 30 см', 119000),
    ('30 × 30 см', 139000),
    ('40 × 30 см', 149000), ('30 × 40 см', 149000),
    ('40 × 40 см', 169000),
    ('50 × 40 см', 179000), ('40 × 50 см', 179000),
    ('50 × 50 см', 229000),
    ('60 × 40 см', 199000), ('40 × 60 см', 199000),
    ('60 × 45 см', 219000), ('45 × 60 см', 219000),
    ('60 × 60 см', 299000),
    ('70 × 50 см', 259000), ('50 × 70 см', 259000),
    ('70 × 70 см', 389000),
    ('80 × 60 см', 319000), ('60 × 80 см', 319000),
    ('80 × 80 см', 489000),
    ('90 × 60 см', 359000), ('60 × 90 см', 359000),
    ('100 × 70 см', 469000), ('70 × 100 см', 469000),
    ('100 × 100 см', 649000),
    ('120 × 80 см', 599000), ('80 × 120 см', 599000),
    ('140 × 100 см', 749000), ('100 × 140 см', 749000)
  ) as p(canvas_size, price_kop)
  where p.canvas_size = new.canvas_size;

  if expected is null then
    raise exception using errcode = '22023', message = 'CANVAS_SIZE_UNAVAILABLE';
  end if;
  if new.price_kop is distinct from expected then
    raise exception using errcode = '22023', message = 'CANVAS_PRICE_CHANGED';
  end if;
  return new;
end;
$$;
revoke all on function pg_temp.validate_new_canvas_price() from public, anon, authenticated;
create trigger validate_new_canvas_price
before insert on pg_temp.canvas_price_test
for each row execute function pg_temp.validate_new_canvas_price();


grant insert on canvas_price_test to anon, authenticated;
set local role anon;
insert into pg_temp.canvas_price_test(canvas_size,price_kop) values ('20 × 20 см',99000);
do $$ begin
  begin
    insert into pg_temp.canvas_price_test(canvas_size,price_kop) values ('20 × 20 см',1);
    raise exception 'FAIL: modified price accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'CANVAS_PRICE_CHANGED' then raise; end if;
  end;
  begin
    insert into pg_temp.canvas_price_test(canvas_size,price_kop) values ('invalid',99000);
    raise exception 'FAIL: invalid size accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'CANVAS_SIZE_UNAVAILABLE' then raise; end if;
  end;
  begin
    insert into pg_temp.canvas_price_test(canvas_size,price_kop) values ('20 × 20 см',null);
    raise exception 'FAIL: null price accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'CANVAS_PRICE_CHANGED' then raise; end if;
  end;
end $$;
reset role;
update pg_temp.canvas_price_test set status='done' where canvas_size='legacy size';
select count(*)=2 as only_valid_inserts, bool_or(canvas_size='legacy size' and price_kop=123 and status='done') as legacy_preserved from pg_temp.canvas_price_test;
rollback;
