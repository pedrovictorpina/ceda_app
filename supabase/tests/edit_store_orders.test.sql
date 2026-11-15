begin;
select plan(12);
insert into auth.users (id, email, raw_app_meta_data) values
  ('73000000-0000-4000-8000-000000000001', 'operator@edit.test', '{"roles":["cashier"]}'),
  ('73000000-0000-4000-8000-000000000002', 'member@edit.test', '{"roles":["member"]}');
insert into public.profiles (id, full_name, email) values
  ('73000000-0000-4000-8000-000000000001', 'Operador', 'operator@edit.test'),
  ('73000000-0000-4000-8000-000000000002', 'Membro', 'member@edit.test');
select set_config('request.jwt.claims', '{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"roles":["cashier"]}}', true);
set local role authenticated;
insert into public.store_products (id, name, sale_price, created_by) values
  ('73000000-0000-4000-8000-000000000003', 'Produto A', 8, '73000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000004', 'Produto B', 5, '73000000-0000-4000-8000-000000000001');
insert into public.inventory_batches (product_id, quantity_received, quantity_on_hand, received_by) values
  ('73000000-0000-4000-8000-000000000003', 10, 10, '73000000-0000-4000-8000-000000000001'),
  ('73000000-0000-4000-8000-000000000004', 10, 10, '73000000-0000-4000-8000-000000000001');
select public.create_store_cash_day();
insert into public.store_cash_day_products (cash_day_id, product_id)
select d.id, p.id from public.store_cash_days d cross join public.store_products p
where d.status = 'preparing' and p.id in ('73000000-0000-4000-8000-000000000003', '73000000-0000-4000-8000-000000000004');
select public.start_store_cash_day((select id from public.store_cash_days where status = 'preparing'), null);
select public.create_counter_order('73000000-0000-4000-8000-000000000005', null, '[{"product_id":"73000000-0000-4000-8000-000000000003","quantity":2}]');
select lives_ok($$select public.edit_store_order('73000000-0000-4000-8000-000000000005', (select updated_at from public.store_orders where id = '73000000-0000-4000-8000-000000000005'), '[{"product_id":"73000000-0000-4000-8000-000000000003","quantity":3},{"product_id":"73000000-0000-4000-8000-000000000004","quantity":1}]')$$, 'can add and increase items before payment');
select is((select total_amount from public.store_orders where id = '73000000-0000-4000-8000-000000000005'), 29::numeric, 'total includes both items');
select is((select stock_available from public.store_products where id = '73000000-0000-4000-8000-000000000003'), 7::numeric, 'increase reserves extra stock');
select throws_ok($$select public.edit_store_order('73000000-0000-4000-8000-000000000005', now() - interval '1 day', '[{"product_id":"73000000-0000-4000-8000-000000000003","quantity":1}]')$$, 'P0001', null, 'stale edit is rejected');
select throws_ok($$select public.edit_store_order('73000000-0000-4000-8000-000000000005', (select updated_at from public.store_orders where id = '73000000-0000-4000-8000-000000000005'), '[{"product_id":"73000000-0000-4000-8000-000000000003","quantity":99}]')$$, 'P0001', null, 'insufficient stock rejects the edit');
select is((select total_amount from public.store_orders where id = '73000000-0000-4000-8000-000000000005'), 29::numeric, 'failed edit preserves the original total');
update public.store_orders set status = 'ready_for_pickup', payment_method = 'pix' where id = '73000000-0000-4000-8000-000000000005';
update public.store_products set sale_price = 20 where id = '73000000-0000-4000-8000-000000000003';
select lives_ok($$select public.edit_store_order('73000000-0000-4000-8000-000000000005', (select updated_at from public.store_orders where id = '73000000-0000-4000-8000-000000000005'), '[{"product_id":"73000000-0000-4000-8000-000000000003","quantity":1}]')$$, 'can remove and reduce items after payment');
select is((select total_amount from public.store_orders where id = '73000000-0000-4000-8000-000000000005'), 8::numeric, 'existing item retains its original price');
select is((select stock_available from public.store_products where id = '73000000-0000-4000-8000-000000000003'), 9::numeric, 'reducing quantity releases stock');
select is((select stock_available from public.store_products where id = '73000000-0000-4000-8000-000000000004'), 10::numeric, 'removing an item releases stock');
reset role;
select set_config('request.jwt.claims', '{"sub":"73000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select throws_ok($$select public.edit_store_order('73000000-0000-4000-8000-000000000005', now(), '[{"product_id":"73000000-0000-4000-8000-000000000003","quantity":1}]')$$, '42501', null, 'member cannot edit orders');
reset role;
select is((select count(*)::integer from private.store_order_edit_history where order_id = '73000000-0000-4000-8000-000000000005'), 2, 'successful edits retain their previous state');
select * from finish();
rollback;
