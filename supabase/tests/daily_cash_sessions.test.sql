begin;
select plan(19);

select has_table('public', 'store_cash_days', 'cash days are persisted');
select has_table('public', 'store_cash_day_products', 'daily product selection is persisted');
select ok((select relrowsecurity from pg_class where oid = 'public.store_cash_days'::regclass), 'cash days use RLS');
select ok(not has_table_privilege('anon', 'public.store_cash_days', 'select'), 'anonymous users cannot read cash days');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cashier@cash.test', '', now(), '{"roles":["member","cashier"]}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'buyer@cash.test', '', now(), '{"roles":["member"]}', '{}', now(), now()),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'counter@cash.test', '', now(), '{"roles":["member","counter"]}', '{}', now(), now());

insert into public.profiles (id, full_name, email) values
  ('40000000-0000-0000-0000-000000000001', 'Cashier Cash', 'cashier@cash.test'),
  ('40000000-0000-0000-0000-000000000002', 'Buyer Cash', 'buyer@cash.test'),
  ('40000000-0000-0000-0000-000000000003', 'Counter Cash', 'counter@cash.test');

insert into public.store_products (id, name, sale_price, created_by)
values ('40000000-0000-0000-0000-000000000004', 'Produto do dia', 7.50, '40000000-0000-0000-0000-000000000001');
insert into public.inventory_batches (product_id, quantity_received, quantity_on_hand, received_by)
values ('40000000-0000-0000-0000-000000000004', 3, 3, '40000000-0000-0000-0000-000000000001');

select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select throws_ok($$select public.create_store_cash_day()$$, '42501', null, 'member cannot prepare a cash day');
select throws_ok(
  $$insert into public.store_orders (buyer_id) values ('40000000-0000-0000-0000-000000000002')$$,
  'P0001', null, 'member cannot order before opening'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["member","cashier"]}}', true);
set local role authenticated;
select lives_ok($$select public.create_store_cash_day()$$, 'cashier can prepare a cash day');
select throws_ok(
  $$select public.start_store_cash_day((select id from public.store_cash_days where status = 'preparing'), null)$$,
  'P0001', null, 'day cannot start without selected stock'
);
select lives_ok(
  $$insert into public.store_cash_day_products (cash_day_id, product_id)
    select id, '40000000-0000-0000-0000-000000000004' from public.store_cash_days where status = 'preparing'$$,
  'cashier can select a product before opening'
);
select lives_ok(
  $$select public.start_store_cash_day((select id from public.store_cash_days where status = 'preparing'), null)$$,
  'cashier can start sales'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.store_cash_days where status = 'open'), 1, 'member sees the open day');
select lives_ok(
  $$insert into public.store_orders (id, buyer_id)
    values ('40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000002')$$,
  'member can place an order while open'
);
select lives_ok(
  $$insert into public.store_order_items (order_id, product_id, quantity, unit_price)
    values ('40000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000004', 1, 0)$$,
  'member can reserve a selected product'
);
select is((select buyer_name from public.store_orders where id = '40000000-0000-0000-0000-000000000005'), 'Buyer Cash', 'buyer name is copied onto the order');

reset role;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["member","cashier"]}}', true);
set local role authenticated;
select throws_ok(
  $$update public.store_orders set status = 'ready_for_pickup' where id = '40000000-0000-0000-0000-000000000005'$$,
  'P0001', null, 'payment method is required to confirm'
);
select lives_ok(
  $$update public.store_orders set status = 'ready_for_pickup', payment_method = 'pix'
    where id = '40000000-0000-0000-0000-000000000005'$$,
  'cashier confirms with a payment method'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"roles":["member","counter"]}}', true);
set local role authenticated;
select lives_ok(
  $$update public.store_orders set status = 'fulfilled' where id = '40000000-0000-0000-0000-000000000005'$$,
  'counter can deliver a paid order'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["member","cashier"]}}', true);
set local role authenticated;
select lives_ok($$select public.close_store_cash_day((select id from public.store_cash_days where status = 'open'))$$, 'cashier can close the day');

reset role;
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.store_orders (buyer_id) values ('40000000-0000-0000-0000-000000000002')$$,
  'P0001', null, 'member cannot order after closing'
);

select * from finish();
rollback;
