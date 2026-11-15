begin;
select plan(24);
insert into auth.users (id, email, raw_app_meta_data) values
 ('72000000-0000-4000-8000-000000000001', 'operator@counter.test', '{"roles":["cashier"]}'),
 ('72000000-0000-4000-8000-000000000002', 'member@counter.test', '{"roles":["member"]}');
insert into public.profiles (id, full_name, email) values
 ('72000000-0000-4000-8000-000000000001', 'Operador', 'operator@counter.test'),
 ('72000000-0000-4000-8000-000000000002', 'Membro', 'member@counter.test');
select set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"roles":["cashier"]}}', true);
set local role authenticated;
insert into public.store_products (id, name, sale_price, created_by) values
 ('72000000-0000-4000-8000-000000000003', 'Produto balcão', 8, '72000000-0000-4000-8000-000000000001');
insert into public.inventory_batches (product_id, quantity_received, quantity_on_hand, received_by) values
 ('72000000-0000-4000-8000-000000000003', 4, 4, '72000000-0000-4000-8000-000000000001');
select throws_ok($$select public.create_counter_order('72000000-0000-4000-8000-000000000010', null, '[{"product_id":"72000000-0000-4000-8000-000000000003","quantity":1}]')$$, 'P0001', null, 'closed cash day rejects order');
select public.create_store_cash_day();
insert into public.store_cash_day_products (cash_day_id, product_id) select id, '72000000-0000-4000-8000-000000000003' from public.store_cash_days where status = 'preparing';
select public.start_store_cash_day((select id from public.store_cash_days where status = 'preparing'), null);
select lives_ok($$select public.create_counter_order('72000000-0000-4000-8000-000000000010', '   ', '[{"product_id":"72000000-0000-4000-8000-000000000003","quantity":1}]')$$, 'operator creates unnamed order');
select is((select daily_order_number from public.store_orders where id = '72000000-0000-4000-8000-000000000010'), 1::bigint, 'first order starts at one');
select is((select daily_order_date from public.store_orders where id = '72000000-0000-4000-8000-000000000010'), (now() at time zone 'America/Sao_Paulo')::date, 'number records the cash day');
select throws_ok($$update public.store_orders set daily_order_number = 999 where id = '72000000-0000-4000-8000-000000000010'$$, '42501', null, 'daily number is immutable');
select is((select buyer_id is null and buyer_name is null and created_by = '72000000-0000-4000-8000-000000000001' and order_source = 'counter' from public.store_orders where id = '72000000-0000-4000-8000-000000000010'), true, 'customer is unlinked and operator is recorded');
select lives_ok($$select public.create_counter_order('72000000-0000-4000-8000-000000000010', null, '[{"product_id":"72000000-0000-4000-8000-000000000003","quantity":1}]')$$, 'retry succeeds idempotently');
select is((select stock_available from public.store_products where id = '72000000-0000-4000-8000-000000000003'), 3::numeric, 'retry reserves only once');
select throws_ok($$select public.create_counter_order('72000000-0000-4000-8000-000000000011', 'Cliente', '[{"product_id":"72000000-0000-4000-8000-000000000003","quantity":99}]')$$, 'P0001', null, 'insufficient stock rejects order');
select is((select count(*)::integer from public.store_orders where id = '72000000-0000-4000-8000-000000000011'), 0, 'failed order rolls back');
select throws_ok($$select public.create_counter_order('72000000-0000-4000-8000-000000000015', null, '[{"product_id":"72000000-0000-4000-8000-000000000003","quantity":1},{"product_id":"72000000-0000-4000-8000-000000000003","quantity":1}]')$$, '23505', null, 'duplicate items reject the whole transaction');
select is((select stock_available from public.store_products where id = '72000000-0000-4000-8000-000000000003'), 3::numeric, 'partial reservation is rolled back');
select lives_ok($$update public.store_orders set status = 'ready_for_pickup', payment_method = 'pix' where id = '72000000-0000-4000-8000-000000000010'$$, 'unnamed order can be paid');
select lives_ok($$update public.store_orders set status = 'fulfilled' where id = '72000000-0000-4000-8000-000000000010'$$, 'unnamed order can be delivered');
select is((select quantity_on_hand from public.inventory_batches where product_id = '72000000-0000-4000-8000-000000000003'), 3::numeric, 'delivery consumes stock');
select lives_ok($$select public.create_counter_order('72000000-0000-4000-8000-000000000012', ' Maria ', '[{"product_id":"72000000-0000-4000-8000-000000000003","quantity":1}]')$$, 'named order created');
select is((select daily_order_number from public.store_orders where id = '72000000-0000-4000-8000-000000000012'), 2::bigint, 'failed and retried orders do not consume numbers');
select is((select buyer_name from public.store_orders where id = '72000000-0000-4000-8000-000000000012'), 'Maria', 'free text name is trimmed');
select lives_ok($$update public.store_orders set status = 'cancelled' where id = '72000000-0000-4000-8000-000000000012'$$, 'counter order can be cancelled');
select is((select stock_available from public.store_products where id = '72000000-0000-4000-8000-000000000003'), 3::numeric, 'cancellation releases reservation');
reset role;
select set_config('request.jwt.claims', '{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select throws_ok($$select public.create_counter_order('72000000-0000-4000-8000-000000000013', 'Cliente', '[{"product_id":"72000000-0000-4000-8000-000000000003","quantity":1}]')$$, '42501', null, 'member cannot create counter order');
select is((select count(*)::integer from public.store_orders where id = '72000000-0000-4000-8000-000000000010'), 0, 'member cannot see counter order');
select lives_ok($$insert into public.store_orders (id, buyer_id) values ('72000000-0000-4000-8000-000000000014', '72000000-0000-4000-8000-000000000002')$$, 'member order remains available');
select is((select buyer_name from public.store_orders where id = '72000000-0000-4000-8000-000000000014'), 'Membro', 'member name still comes from profile');
select * from finish();
rollback;
