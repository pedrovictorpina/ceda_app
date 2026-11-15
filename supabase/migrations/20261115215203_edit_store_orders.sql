create table private.store_order_edit_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.store_orders(id),
  edited_by uuid not null references public.profiles(id),
  edited_at timestamptz not null default now(),
  previous_items jsonb not null,
  new_items jsonb not null
);

revoke all on private.store_order_edit_history from public, anon, authenticated;

create function private.adjust_edited_order_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  delta numeric(12,3);
  remaining numeric(12,3);
  available numeric(12,3);
  allocated numeric(12,3);
  batch_row public.inventory_batches%rowtype;
  reservation_row public.inventory_reservations%rowtype;
begin
  delta := case when tg_op = 'DELETE' then -old.quantity else new.quantity - old.quantity end;
  if delta = 0 then return new; end if;
  perform 1 from public.store_products where id = old.product_id for update;

  if delta > 0 then
    if not exists (select 1 from public.store_products where id = old.product_id and active and stock_available >= delta) then
      raise exception 'Estoque insuficiente para editar o pedido.' using errcode = 'P0001';
    end if;
    remaining := delta;
    for batch_row in select * from public.inventory_batches
      where product_id = old.product_id and quantity_on_hand > 0 and (expires_on is null or expires_on >= current_date)
      order by expires_on nulls last, received_at, id for update
    loop
      select batch_row.quantity_on_hand - coalesce(sum(quantity), 0) into available
      from public.inventory_reservations where batch_id = batch_row.id and released_at is null and consumed_at is null;
      allocated := least(remaining, greatest(available, 0));
      if allocated > 0 then
        insert into public.inventory_reservations (order_item_id, batch_id, quantity) values (old.id, batch_row.id, allocated);
        remaining := remaining - allocated;
      end if;
      exit when remaining = 0;
    end loop;
    if remaining > 0 then raise exception 'Estoque insuficiente para editar o pedido.' using errcode = 'P0001'; end if;
  else
    remaining := -delta;
    for reservation_row in select * from public.inventory_reservations
      where order_item_id = old.id and released_at is null and consumed_at is null order by created_at desc, id for update
    loop
      allocated := least(remaining, reservation_row.quantity);
      if allocated = reservation_row.quantity then
        update public.inventory_reservations set released_at = now() where id = reservation_row.id;
      else
        update public.inventory_reservations set quantity = quantity - allocated where id = reservation_row.id;
        insert into public.inventory_reservations (order_item_id, batch_id, quantity, released_at)
        values (old.id, reservation_row.batch_id, allocated, now());
      end if;
      remaining := remaining - allocated;
      exit when remaining = 0;
    end loop;
    if remaining > 0 then raise exception 'Reserva do pedido inconsistente.' using errcode = 'P0001'; end if;
  end if;

  update public.store_products set stock_available = stock_available - delta where id = old.product_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.adjust_edited_order_item() from public, anon, authenticated;

create trigger store_order_items_adjust_stock before update of quantity or delete on public.store_order_items
for each row execute function private.adjust_edited_order_item();
create trigger store_order_items_sync_total_update after update of quantity on public.store_order_items
for each row execute function private.sync_store_order_total();

create function public.edit_store_order(p_order_id uuid, p_expected_updated_at timestamptz, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_order public.store_orders%rowtype;
  item record;
  previous_items jsonb;
begin
  if (select auth.uid()) is null or not public.current_user_can_operate_store() then
    raise exception 'Somente operadores podem editar pedidos.' using errcode = '42501';
  end if;
  select * into current_order from public.store_orders where id = p_order_id for update;
  if not found or current_order.status not in ('awaiting_payment', 'ready_for_pickup') then
    raise exception 'Este pedido não pode ser editado.' using errcode = 'P0001';
  end if;
  if p_expected_updated_at is null or current_order.updated_at is distinct from p_expected_updated_at then
    raise exception 'O pedido foi alterado. Atualize e tente novamente.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Selecione entre 1 e 100 produtos.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) x where jsonb_typeof(x) <> 'object' or x->>'product_id' is null or x->>'quantity' is null)
    or (select count(distinct x->>'product_id') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
    raise exception 'Itens inválidos.' using errcode = 'P0001';
  end if;
  for item in select (x->>'product_id')::uuid as product_id, (x->>'quantity')::numeric as quantity from jsonb_array_elements(p_items) x loop
    if item.quantity <= 0 or item.quantity <> trunc(item.quantity) or item.quantity > 999999999 then
      raise exception 'Quantidade inválida.' using errcode = 'P0001';
    end if;
  end loop;
  perform 1 from public.store_products where id in (
    select product_id from public.store_order_items where order_id = p_order_id
    union select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x
  ) order by id for update;

  select coalesce(jsonb_agg(jsonb_build_object('product_id', i.product_id, 'quantity', i.quantity, 'unit_price', i.unit_price,
    'reservations', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.inventory_reservations r where r.order_item_id = i.id))), '[]'::jsonb)
  into previous_items from public.store_order_items i where i.order_id = p_order_id;
  insert into private.store_order_edit_history (order_id, edited_by, previous_items, new_items)
  values (p_order_id, (select auth.uid()), previous_items, p_items);

  delete from public.store_order_items where order_id = p_order_id
    and product_id not in (select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x);
  for item in select (x->>'product_id')::uuid as product_id, (x->>'quantity')::numeric as quantity
    from jsonb_array_elements(p_items) x order by 1
  loop
    update public.store_order_items set quantity = item.quantity
      where order_id = p_order_id and product_id = item.product_id and quantity <> item.quantity;
    if not found and not exists (select 1 from public.store_order_items where order_id = p_order_id and product_id = item.product_id) then
      insert into public.store_order_items (order_id, product_id, quantity, unit_price) values (p_order_id, item.product_id, item.quantity, 0);
    end if;
  end loop;
end;
$$;

revoke all on function public.edit_store_order(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.edit_store_order(uuid, timestamptz, jsonb) to authenticated;
