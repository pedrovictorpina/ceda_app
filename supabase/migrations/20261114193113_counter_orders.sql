-- Counter customers are not application members. Existing buyer IDs remain intact.
alter table public.store_orders alter column buyer_id drop not null;
alter table public.store_orders add column order_source text not null default 'member'
  check (order_source in ('member', 'counter'));
alter table public.store_orders add column created_by uuid references public.profiles(id);
alter table public.store_orders add constraint store_orders_customer_identity_check
  check ((order_source = 'member' and buyer_id is not null) or
         (order_source = 'counter' and buyer_id is null and created_by is not null));

create or replace function private.assign_store_cash_day()
returns trigger language plpgsql security definer set search_path = '' as $$
declare current_day public.store_cash_days%rowtype;
begin
  select * into current_day from public.store_cash_days
  where status = 'open' and (auto_close_at is null or auto_close_at > now()) for share;
  if not found then raise exception 'O caixa está fechado para novos pedidos.' using errcode = 'P0001'; end if;
  new.cash_day_id := current_day.id;
  new.created_by := (select auth.uid());
  if new.order_source = 'counter' then
    if not public.current_user_can_operate_store() or new.buyer_id is not null then
      raise exception 'Somente operadores podem criar pedidos de balcão.' using errcode = '42501';
    end if;
    new.buyer_name := nullif(trim(new.buyer_name), '');
    if char_length(new.buyer_name) > 120 then raise exception 'Nome do cliente muito longo.'; end if;
  else
    select full_name into new.buyer_name from public.profiles where id = new.buyer_id;
  end if;
  return new;
end;
$$;

-- Keep audit fields immutable even during legitimate status transitions.
create function private.guard_store_order_origin()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.order_source is distinct from old.order_source or new.created_by is distinct from old.created_by then
    raise exception 'Origem e operador do pedido não podem ser alterados.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger store_orders_guard_origin before update on public.store_orders
for each row execute function private.guard_store_order_origin();

-- One transaction for order and all items; the supplied ID makes retries safe.
create function public.create_counter_order(p_order_id uuid, p_customer_name text, p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare item record; existing_order public.store_orders%rowtype;
begin
  if (select auth.uid()) is null or not public.current_user_can_operate_store() then
    raise exception 'Somente operadores podem criar pedidos de balcão.' using errcode = '42501';
  end if;
  if p_order_id is null then raise exception 'Identificador do pedido obrigatório.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  select * into existing_order from public.store_orders where id = p_order_id;
  if found then
    if existing_order.order_source <> 'counter' or existing_order.created_by <> (select auth.uid()) then
      raise exception 'Identificador de pedido já utilizado.' using errcode = '42501';
    end if;
    return existing_order.id;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Selecione entre 1 e 100 produtos.';
  end if;
  insert into public.store_orders (id, buyer_id, buyer_name, order_source)
  values (p_order_id, null, p_customer_name, 'counter');
  -- Stable lock order prevents two multi-product orders from deadlocking each other.
  for item in select (value->>'product_id')::uuid as product_id, (value->>'quantity')::numeric as quantity
    from jsonb_array_elements(p_items) order by 1
  loop
    if item.quantity is null or item.quantity <= 0 or item.quantity <> trunc(item.quantity) then
      raise exception 'Quantidade inválida.';
    end if;
    insert into public.store_order_items (order_id, product_id, quantity, unit_price)
    values (p_order_id, item.product_id, item.quantity, 0);
  end loop;
  return p_order_id;
end;
$$;
revoke all on function public.create_counter_order(uuid, text, jsonb) from public, anon;
grant execute on function public.create_counter_order(uuid, text, jsonb) to authenticated;
