-- Run once for an existing CANVASO Supabase project.
-- Customers can create short-lived links only for photos referenced by their orders.
create policy "Customers view own order photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'order-photos'
  and exists (
    select 1
    from public.orders
    where public.orders.customer_id = (select auth.uid())
      and public.orders.photo_path = storage.objects.name
  )
);
