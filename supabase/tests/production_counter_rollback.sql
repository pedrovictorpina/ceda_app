-- Run only as a single transaction; all fixture rows and stock changes roll back.
-- Identity sequences may still advance in PostgreSQL.
begin;
insert into auth.users (id, email, raw_app_meta_data) values
 ('79000000-0000-4000-8000-000000000001', 'counter-rollback@invalid.example', '{"roles":["cashier"]}'),
 ('79000000-0000-4000-8000-000000000002', 'member-rollback@invalid.example', '{"roles":["member"]}');
insert into public.profiles (id, full_name, email) values
 ('79000000-0000-4000-8000-000000000001', 'Teste temporário', 'counter-rollback@invalid.example'),
 ('79000000-0000-4000-8000-000000000002', 'Membro temporário', 'member-rollback@invalid.example');
insert into public.store_products (id, name, sale_price, created_by) values
 ('79000000-0000-4000-8000-000000000003', 'Produto temporário rollback', 8, '79000000-0000-4000-8000-000000000001');
insert into public.inventory_batches (product_id, quantity_received, quantity_on_hand, received_by) values
 ('79000000-0000-4000-8000-000000000003', 4, 4, '79000000-0000-4000-8000-000000000001');
-- If today's day is being prepared, open it only within this rolled-back transaction.
update public.store_cash_days set status = 'open', started_at = coalesce(started_at, now()) where status = 'preparing';
insert into public.store_cash_day_products (cash_day_id, product_id)
select id, '79000000-0000-4000-8000-000000000003' from public.store_cash_days
where status = 'open' and (auto_close_at is null or auto_close_at > now());
select set_config('request.jwt.claims', '{"sub":"79000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"roles":["cashier"]}}', true);
set local role authenticated;
select public.create_counter_order('79000000-0000-4000-8000-000000000010', null, '[{"product_id":"79000000-0000-4000-8000-000000000003","quantity":1}]');
select public.create_counter_order('79000000-0000-4000-8000-000000000010', null, '[{"product_id":"79000000-0000-4000-8000-000000000003","quantity":1}]');
do $$ begin
  if not exists (select 1 from public.store_orders where id='79000000-0000-4000-8000-000000000010' and buyer_id is null and buyer_name is null and created_by='79000000-0000-4000-8000-000000000001') then raise exception 'Identidade incorreta'; end if;
  if (select stock_available from public.store_products where id='79000000-0000-4000-8000-000000000003') <> 3 then raise exception 'Reserva repetida'; end if;
  begin
    perform public.create_counter_order('79000000-0000-4000-8000-000000000011', 'Teste', '[{"product_id":"79000000-0000-4000-8000-000000000003","quantity":99}]');
    raise exception 'Estoque insuficiente aceito';
  exception when sqlstate 'P0001' then
    if sqlerrm = 'Estoque insuficiente aceito' then raise; end if;
  end;
  if exists (select 1 from public.store_orders where id='79000000-0000-4000-8000-000000000011') then raise exception 'Pedido parcial'; end if;
end $$;
update public.store_orders set status='ready_for_pickup',payment_method='pix' where id='79000000-0000-4000-8000-000000000010';
update public.store_orders set status='fulfilled' where id='79000000-0000-4000-8000-000000000010';
do $$ begin
  if not exists (select 1 from public.store_orders where id='79000000-0000-4000-8000-000000000010' and status='fulfilled' and confirmed_by=created_by and fulfilled_by=created_by) then raise exception 'Pagamento ou entrega falhou'; end if;
end $$;
select public.create_counter_order('79000000-0000-4000-8000-000000000012', ' Maria ', '[{"product_id":"79000000-0000-4000-8000-000000000003","quantity":1}]');
update public.store_orders set status='cancelled' where id='79000000-0000-4000-8000-000000000012';
do $$ begin
  if (select stock_available from public.store_products where id='79000000-0000-4000-8000-000000000003') <> 3 then raise exception 'Cancelamento não liberou estoque'; end if;
end $$;
select set_config('request.jwt.claims', '{"sub":"79000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
do $$ begin
  begin
    perform public.create_counter_order('79000000-0000-4000-8000-000000000013', null, '[{"product_id":"79000000-0000-4000-8000-000000000003","quantity":1}]');
    raise exception 'Membro não autorizado aceito';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select 'Fluxo transacional validado; registros revertidos' as resultado;
