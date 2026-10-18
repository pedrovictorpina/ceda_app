begin;
select plan(24);

insert into auth.users (id, email, raw_app_meta_data) values
  ('61000000-0000-4000-8000-000000000001', 'cashier@operator.test', '{"roles":["member","cashier"]}'),
  ('61000000-0000-4000-8000-000000000002', 'counter@operator.test', '{"roles":["member","counter"]}'),
  ('61000000-0000-4000-8000-000000000003', 'member@operator.test', '{"roles":["member"]}');
insert into public.profiles (id, full_name, email) values
  ('61000000-0000-4000-8000-000000000001', 'Caixa Teste', 'cashier@operator.test'),
  ('61000000-0000-4000-8000-000000000002', 'Balcão Teste', 'counter@operator.test'),
  ('61000000-0000-4000-8000-000000000003', 'Membro Teste', 'member@operator.test');

-- Existing tokens contain just one alias, and must already work without refresh.
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"roles":["member","counter"]}}', true);
set local role authenticated;
select is(public.current_user_has_role('cashier'), true, 'legacy counter has cashier rights');
select is(public.current_user_has_role('administrator'), false, 'store operator has no administrator rights');
select lives_ok($$insert into public.store_products (id, name, sale_price, created_by)
  values ('61000000-0000-4000-8000-000000000004', 'Produto unificado', 7.50, '61000000-0000-4000-8000-000000000002')$$,
  'legacy counter can create a store product');
select lives_ok($$insert into public.inventory_batches (product_id, quantity_received, quantity_on_hand, received_by)
  values ('61000000-0000-4000-8000-000000000004', 3, 3, '61000000-0000-4000-8000-000000000002')$$,
  'legacy counter can receive stock');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id)
  values ('store-product-images', 'operator-fixture.png', '61000000-0000-4000-8000-000000000002')$$,
  'legacy counter can upload product images');
select lives_ok($$select public.create_store_cash_day()$$, 'legacy counter can prepare a cash day');
select lives_ok($$insert into public.store_cash_day_products (cash_day_id, product_id)
  select id, '61000000-0000-4000-8000-000000000004' from public.store_cash_days where status = 'preparing'$$,
  'legacy counter can select products for the day');
select lives_ok($$select public.start_store_cash_day((select id from public.store_cash_days where status = 'preparing'), null)$$,
  'legacy counter can open the cash day');

reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"roles":["member"]},"user_metadata":{"roles":["administrator","cashier","counter"]}}', true);
set local role authenticated;
select is(public.current_user_can_operate_store(), false, 'member cannot grant store access through editable metadata');
select throws_ok($$select public.close_store_cash_day((select id from public.store_cash_days where status = 'open'))$$,
  '42501', null, 'member cannot close the cash day');
insert into public.store_orders (id, buyer_id) values
  ('61000000-0000-4000-8000-000000000005', '61000000-0000-4000-8000-000000000003'),
  ('61000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000003');
insert into public.store_order_items (order_id, product_id, quantity, unit_price) values
  ('61000000-0000-4000-8000-000000000005', '61000000-0000-4000-8000-000000000004', 1, 0),
  ('61000000-0000-4000-8000-000000000006', '61000000-0000-4000-8000-000000000004', 1, 0);
select throws_ok($$update public.store_orders set status = 'ready_for_pickup', payment_method = 'pix'
  where id = '61000000-0000-4000-8000-000000000005'$$, '42501', null, 'member cannot confirm payment');

reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"roles":["member","cashier"]}}', true);
set local role authenticated;
select is(public.current_user_has_role('counter'), true, 'cashier has delivery rights');
select throws_ok($$update public.store_orders set status = 'fulfilled'
  where id = '61000000-0000-4000-8000-000000000005'$$, '42501', null, 'cashier cannot deliver before payment');
select throws_ok($$update public.store_orders set status = 'ready_for_pickup'
  where id = '61000000-0000-4000-8000-000000000005'$$, 'P0001', null, 'cashier must record a payment method');
select lives_ok($$update public.store_orders set status = 'ready_for_pickup', payment_method = 'pix'
  where id = '61000000-0000-4000-8000-000000000005'$$, 'cashier can confirm payment');
select lives_ok($$update public.store_orders set status = 'fulfilled'
  where id = '61000000-0000-4000-8000-000000000005'$$, 'same cashier can deliver the paid order');
select is((select confirmed_by = fulfilled_by from public.store_orders where id = '61000000-0000-4000-8000-000000000005'),
  true, 'cashier identity is recorded for both payment and delivery');

reset role;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"roles":["member","counter"]}}', true);
set local role authenticated;
select lives_ok($$update public.store_orders set status = 'ready_for_pickup', payment_method = 'cash'
  where id = '61000000-0000-4000-8000-000000000006'$$, 'legacy counter can confirm payment');
select lives_ok($$update public.store_orders set status = 'fulfilled'
  where id = '61000000-0000-4000-8000-000000000006'$$, 'same legacy counter can deliver the paid order');
select is((select confirmed_by = fulfilled_by from public.store_orders where id = '61000000-0000-4000-8000-000000000006'),
  true, 'counter identity is recorded for both payment and delivery');
select is((select stock_available = 1 from public.store_products where id = '61000000-0000-4000-8000-000000000004'),
  true, 'both deliveries debit stock exactly once');
select is((select quantity_on_hand = 1 from public.inventory_batches where product_id = '61000000-0000-4000-8000-000000000004'),
  true, 'the batch balance is preserved');
select is((select count(*)::integer from public.store_orders where status = 'fulfilled'), 2,
  'operator can read fulfilled orders for store reports');
select lives_ok($$select public.close_store_cash_day((select id from public.store_cash_days where status = 'open'))$$,
  'legacy counter can close the cash day');

select * from finish();
rollback;
