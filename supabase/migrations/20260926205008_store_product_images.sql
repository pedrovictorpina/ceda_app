alter table public.store_products add column image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'store-product-images', 'store-product-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy store_product_images_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'store-product-images'
  and (public.current_user_is_manager() or public.current_user_has_role('cashier'))
  and owner_id = (select auth.uid())::text
);

create policy store_product_images_select on storage.objects
for select to authenticated using (
  bucket_id = 'store-product-images'
  and (public.current_user_is_manager() or public.current_user_has_role('cashier'))
);

create policy store_product_images_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'store-product-images'
  and owner_id = (select auth.uid())::text
  and (public.current_user_is_manager() or public.current_user_has_role('cashier'))
);
