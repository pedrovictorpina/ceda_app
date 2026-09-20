create type public.store_order_status as enum ('awaiting_payment', 'ready_for_pickup', 'fulfilled', 'cancelled');
create type public.stock_movement_kind as enum ('entry', 'fulfillment', 'adjustment');

create table public.store_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text,
  sale_price numeric(12,2) not null check (sale_price >= 0),
  stock_available numeric(12,3) not null default 0 check (stock_available >= 0),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.store_products(id),
  quantity_received numeric(12,3) not null check (quantity_received > 0),
  quantity_on_hand numeric(12,3) not null check (quantity_on_hand >= 0),
  unit_cost numeric(12,2) check (unit_cost is null or unit_cost >= 0),
  expires_on date,
  received_at timestamptz not null default now(),
  received_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_on_hand <= quantity_received)
);

create table public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  buyer_id uuid not null references public.profiles(id),
  status public.store_order_status not null default 'awaiting_payment',
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  note text check (char_length(note) <= 500),
  confirmed_by uuid references public.profiles(id),
  confirmed_at timestamptz,
  fulfilled_by uuid references public.profiles(id),
  fulfilled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id uuid not null references public.store_products(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.store_order_items(id) on delete cascade,
  batch_id uuid not null references public.inventory_batches(id),
  quantity numeric(12,3) not null check (quantity > 0),
  released_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (not (released_at is not null and consumed_at is not null))
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.inventory_batches(id),
  product_id uuid not null references public.store_products(id),
  order_id uuid references public.store_orders(id),
  kind public.stock_movement_kind not null,
  quantity_delta numeric(12,3) not null check (quantity_delta <> 0),
  recorded_by uuid not null references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index inventory_batches_product_available_idx on public.inventory_batches (product_id, expires_on, received_at) where quantity_on_hand > 0;
create index store_orders_buyer_status_idx on public.store_orders (buyer_id, status, created_at desc);
create index store_orders_status_created_idx on public.store_orders (status, created_at);
create index store_order_items_order_idx on public.store_order_items (order_id);
create index inventory_reservations_batch_active_idx on public.inventory_reservations (batch_id) where released_at is null and consumed_at is null;

create schema if not exists private;

create function public.current_user_can_operate_store()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.current_user_is_manager()
    or public.current_user_has_role('cashier')
    or public.current_user_has_role('counter')
$$;

revoke all on function public.current_user_can_operate_store() from public;
grant execute on function public.current_user_can_operate_store() to authenticated;

create function private.touch_store_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.guard_store_product_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock_available is distinct from old.stock_available and pg_trigger_depth() = 1 then
    raise exception 'O saldo é atualizado somente por entradas, reservas e entregas.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.guard_inventory_batch_quantity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.quantity_on_hand <> new.quantity_received then
    raise exception 'Uma entrada de estoque deve iniciar com a quantidade recebida.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.quantity_on_hand is distinct from old.quantity_on_hand and pg_trigger_depth() = 1 then
    raise exception 'O saldo do lote é atualizado somente ao concluir uma entrega.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function private.prepare_store_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_row public.store_products%rowtype;
begin
  select * into product_row
  from public.store_products
  where id = new.product_id and active
  for update;

  if not found then
    raise exception 'Produto indisponível.' using errcode = 'P0001';
  end if;
  if product_row.stock_available < new.quantity then
    raise exception 'Estoque insuficiente para este pedido.' using errcode = 'P0001';
  end if;

  new.unit_price := product_row.sale_price;
  update public.store_products
  set stock_available = stock_available - new.quantity, updated_at = now()
  where id = new.product_id;
  return new;
end;
$$;

create function private.reserve_store_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_row public.inventory_batches%rowtype;
  remaining numeric(12,3);
  batch_free numeric(12,3);
  allocation numeric(12,3);
begin
  remaining := new.quantity;

  for batch_row in
    select * from public.inventory_batches
    where product_id = new.product_id
      and quantity_on_hand > 0
      and (expires_on is null or expires_on >= current_date)
    order by expires_on nulls last, received_at, id
    for update
  loop
    select batch_row.quantity_on_hand - coalesce(sum(quantity), 0)
      into batch_free
      from public.inventory_reservations
      where batch_id = batch_row.id and released_at is null and consumed_at is null;
    allocation := least(remaining, greatest(batch_free, 0));
    if allocation > 0 then
      insert into public.inventory_reservations (order_item_id, batch_id, quantity)
      values (new.id, batch_row.id, allocation);
      remaining := remaining - allocation;
    end if;
    exit when remaining = 0;
  end loop;

  if remaining > 0 then
    raise exception 'Estoque insuficiente para reservar este pedido.' using errcode = 'P0001';
  end if;

  return null;
end;
$$;

create function private.sync_store_order_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_order_id uuid;
begin
  if tg_op = 'DELETE' then
    target_order_id := old.order_id;
  else
    target_order_id := new.order_id;
  end if;
  update public.store_orders
  set total_amount = coalesce((
    select sum(quantity * unit_price) from public.store_order_items where order_id = target_order_id
  ), 0), updated_at = now()
  where id = target_order_id;
  return null;
end;
$$;

create function private.guard_store_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_manager boolean := public.current_user_is_manager();
  is_cashier boolean := public.current_user_has_role('cashier');
  is_counter boolean := public.current_user_has_role('counter');
begin
  if pg_trigger_depth() > 1 then
    new.updated_at := now();
    return new;
  end if;

  if new.status = old.status then
    raise exception 'O pedido não pode ser alterado após o envio.' using errcode = '42501';
  end if;

  if new.status = 'cancelled' and old.status in ('awaiting_payment', 'ready_for_pickup')
    and (old.buyer_id = (select auth.uid()) or is_manager or is_cashier or is_counter) then
    new.cancelled_by := (select auth.uid());
    new.cancelled_at := now();
  elsif new.status = 'ready_for_pickup' and old.status = 'awaiting_payment' and (is_manager or is_cashier) then
    new.confirmed_by := (select auth.uid());
    new.confirmed_at := now();
  elsif new.status = 'fulfilled' and old.status = 'ready_for_pickup' and (is_manager or is_counter) then
    new.fulfilled_by := (select auth.uid());
    new.fulfilled_at := now();
  else
    raise exception 'Transição de pedido não permitida para seu papel.' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create function private.apply_store_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row public.inventory_reservations%rowtype;
begin
  if new.status = old.status then return null; end if;

  if new.status = 'cancelled' then
    for reservation_row in
      select r.* from public.inventory_reservations r
      join public.store_order_items i on i.id = r.order_item_id
      where i.order_id = new.id and r.released_at is null and r.consumed_at is null
      for update
    loop
      update public.inventory_reservations set released_at = now() where id = reservation_row.id;
      update public.store_products p
      set stock_available = stock_available + reservation_row.quantity, updated_at = now()
      from public.inventory_batches b
      where b.id = reservation_row.batch_id and p.id = b.product_id;
    end loop;
  elsif new.status = 'fulfilled' then
    for reservation_row in
      select r.* from public.inventory_reservations r
      join public.store_order_items i on i.id = r.order_item_id
      where i.order_id = new.id and r.released_at is null and r.consumed_at is null
      for update
    loop
      update public.inventory_batches
      set quantity_on_hand = quantity_on_hand - reservation_row.quantity, updated_at = now()
      where id = reservation_row.batch_id and quantity_on_hand >= reservation_row.quantity;
      if not found then
        raise exception 'O lote reservado não possui saldo para entrega.' using errcode = 'P0001';
      end if;
      update public.inventory_reservations set consumed_at = now() where id = reservation_row.id;
      insert into public.inventory_movements (batch_id, product_id, order_id, kind, quantity_delta, recorded_by)
      select reservation_row.batch_id, b.product_id, new.id, 'fulfillment', -reservation_row.quantity, (select auth.uid())
      from public.inventory_batches b where b.id = reservation_row.batch_id;
    end loop;
  end if;
  return null;
end;
$$;

create function private.apply_inventory_batch_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.store_products
  set stock_available = stock_available + new.quantity_on_hand, updated_at = now()
  where id = new.product_id;
  insert into public.inventory_movements (batch_id, product_id, kind, quantity_delta, recorded_by)
  values (new.id, new.product_id, 'entry', new.quantity_on_hand, new.received_by);
  return null;
end;
$$;

create trigger store_products_guard_stock before update on public.store_products for each row execute function private.guard_store_product_stock();
create trigger store_products_touch_updated_at before update on public.store_products for each row execute function private.touch_store_updated_at();
create trigger inventory_batches_guard_quantity before insert or update on public.inventory_batches for each row execute function private.guard_inventory_batch_quantity();
create trigger inventory_batches_touch_updated_at before update on public.inventory_batches for each row execute function private.touch_store_updated_at();
create trigger store_orders_guard_change before update on public.store_orders for each row execute function private.guard_store_order_change();
create trigger store_orders_apply_change after update on public.store_orders for each row execute function private.apply_store_order_change();
create trigger store_order_items_prepare before insert on public.store_order_items for each row execute function private.prepare_store_order_item();
create trigger store_order_items_reserve after insert on public.store_order_items for each row execute function private.reserve_store_order_item();
create trigger store_order_items_sync_total after insert or delete on public.store_order_items for each row execute function private.sync_store_order_total();
create trigger inventory_batches_apply_entry after insert on public.inventory_batches for each row execute function private.apply_inventory_batch_entry();

alter table public.store_products enable row level security;
alter table public.inventory_batches enable row level security;
alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.store_products, public.inventory_batches, public.store_orders, public.store_order_items, public.inventory_reservations, public.inventory_movements from anon, authenticated;
grant select on public.store_products to authenticated;
grant insert, update on public.store_products to authenticated;
grant select, insert, update on public.inventory_batches to authenticated;
grant select, insert, update on public.store_orders to authenticated;
grant select, insert on public.store_order_items to authenticated;
grant select on public.inventory_reservations, public.inventory_movements to authenticated;

create policy store_products_select on public.store_products for select to authenticated using (active or public.current_user_can_operate_store());
create policy store_products_manage on public.store_products for all to authenticated using (public.current_user_is_manager() or public.current_user_has_role('cashier')) with check (public.current_user_is_manager() or public.current_user_has_role('cashier'));
create policy inventory_batches_staff_select on public.inventory_batches for select to authenticated using (public.current_user_can_operate_store());
create policy inventory_batches_cashier_write on public.inventory_batches for insert to authenticated with check ((public.current_user_is_manager() or public.current_user_has_role('cashier')) and received_by = (select auth.uid()));
create policy inventory_batches_cashier_update on public.inventory_batches for update to authenticated using (public.current_user_is_manager() or public.current_user_has_role('cashier')) with check (public.current_user_is_manager() or public.current_user_has_role('cashier'));
create policy store_orders_select on public.store_orders for select to authenticated using (buyer_id = (select auth.uid()) or public.current_user_can_operate_store());
create policy store_orders_insert on public.store_orders for insert to authenticated with check (buyer_id = (select auth.uid()) or public.current_user_can_operate_store());
create policy store_orders_update on public.store_orders for update to authenticated using (buyer_id = (select auth.uid()) or public.current_user_can_operate_store()) with check (buyer_id = (select auth.uid()) or public.current_user_can_operate_store());
create policy store_order_items_select on public.store_order_items for select to authenticated using (exists (select 1 from public.store_orders o where o.id = order_id and (o.buyer_id = (select auth.uid()) or public.current_user_can_operate_store())));
create policy store_order_items_insert on public.store_order_items for insert to authenticated with check (exists (select 1 from public.store_orders o where o.id = order_id and o.status = 'awaiting_payment' and (o.buyer_id = (select auth.uid()) or public.current_user_can_operate_store())));
create policy inventory_reservations_staff_select on public.inventory_reservations for select to authenticated using (public.current_user_can_operate_store());
create policy inventory_movements_staff_select on public.inventory_movements for select to authenticated using (public.current_user_can_operate_store());
