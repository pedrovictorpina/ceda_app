create table public.store_cash_days (
  id uuid primary key default gen_random_uuid(),
  business_date date not null unique,
  status text not null default 'preparing' check (status in ('preparing', 'open', 'closed')),
  opened_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  auto_close_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  check (auto_close_at is null or started_at is not null),
  check (closed_at is null or status = 'closed')
);

create unique index store_cash_days_one_active_idx
  on public.store_cash_days ((true)) where status in ('preparing', 'open');

create table public.store_cash_day_products (
  cash_day_id uuid not null references public.store_cash_days(id) on delete cascade,
  product_id uuid not null references public.store_products(id),
  added_at timestamptz not null default now(),
  primary key (cash_day_id, product_id)
);

alter table public.store_orders add column cash_day_id uuid references public.store_cash_days(id);
alter table public.store_orders add column buyer_name text;
alter table public.store_orders add column payment_method text
  check (payment_method in ('cash', 'pix', 'debit_card', 'credit_card'));
create index store_orders_cash_day_idx on public.store_orders (cash_day_id, status);

alter table public.store_cash_days enable row level security;
alter table public.store_cash_day_products enable row level security;
revoke all on public.store_cash_days, public.store_cash_day_products from anon, authenticated;
grant select on public.store_cash_days, public.store_cash_day_products to authenticated;
grant insert, delete on public.store_cash_day_products to authenticated;

create policy store_cash_days_select on public.store_cash_days for select to authenticated
using (status = 'open' or public.current_user_can_operate_store());
create policy store_cash_day_products_select on public.store_cash_day_products for select to authenticated
using (exists (
  select 1 from public.store_cash_days day
  where day.id = cash_day_id and (day.status = 'open' or public.current_user_can_operate_store())
));
create policy store_cash_day_products_insert on public.store_cash_day_products for insert to authenticated
with check (
  (public.current_user_is_manager() or public.current_user_has_role('cashier'))
  and exists (select 1 from public.store_cash_days day where day.id = cash_day_id and day.status = 'preparing')
);
create policy store_cash_day_products_delete on public.store_cash_day_products for delete to authenticated
using (
  (public.current_user_is_manager() or public.current_user_has_role('cashier'))
  and exists (select 1 from public.store_cash_days day where day.id = cash_day_id and day.status = 'preparing')
);

create function public.create_store_cash_day()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  created_id uuid;
begin
  if not (public.current_user_is_manager() or public.current_user_has_role('cashier')) then
    raise exception 'Somente o caixa pode preparar o dia.' using errcode = '42501';
  end if;
  update public.store_cash_days
  set status = 'closed', closed_at = now(), closed_by = (select auth.uid())
  where status = 'preparing' and business_date < (now() at time zone 'America/Sao_Paulo')::date;
  insert into public.store_cash_days (business_date, opened_by)
  values ((now() at time zone 'America/Sao_Paulo')::date, (select auth.uid()))
  returning id into created_id;
  return created_id;
end;
$$;

create function public.start_store_cash_day(p_day_id uuid, p_auto_close_time time default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_day public.store_cash_days%rowtype;
  close_timestamp timestamptz;
begin
  if not (public.current_user_is_manager() or public.current_user_has_role('cashier')) then
    raise exception 'Somente o caixa pode iniciar o dia.' using errcode = '42501';
  end if;
  select * into current_day from public.store_cash_days where id = p_day_id for update;
  if not found or current_day.status <> 'preparing' then
    raise exception 'O dia não está em preparação.' using errcode = 'P0001';
  end if;
  if current_day.business_date <> (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'O caixa deve ser iniciado na data de operação.' using errcode = 'P0001';
  end if;
  if p_auto_close_time is not null then
    close_timestamp := (current_day.business_date + p_auto_close_time) at time zone 'America/Sao_Paulo';
  end if;
  if close_timestamp is not null and close_timestamp <= now() then
    raise exception 'O encerramento automático deve ser futuro.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.store_cash_day_products selection
    join public.store_products product on product.id = selection.product_id
    where selection.cash_day_id = p_day_id and product.active and product.stock_available > 0
  ) then
    raise exception 'Selecione ao menos um produto com estoque antes de iniciar.' using errcode = 'P0001';
  end if;
  update public.store_cash_days set status = 'open', started_at = now(), auto_close_at = close_timestamp
  where id = p_day_id;
end;
$$;

create function public.close_store_cash_day(p_day_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  current_day public.store_cash_days%rowtype;
begin
  if not (public.current_user_is_manager() or public.current_user_has_role('cashier')) then
    raise exception 'Somente o caixa pode encerrar o dia.' using errcode = '42501';
  end if;
  select * into current_day from public.store_cash_days where id = p_day_id for update;
  if not found or current_day.status <> 'open' then
    raise exception 'O caixa não está aberto.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.store_orders where cash_day_id = p_day_id and status = 'awaiting_payment') then
    raise exception 'Resolva os pedidos aguardando pagamento antes de encerrar.' using errcode = 'P0001';
  end if;
  update public.store_cash_days set status = 'closed', closed_at = now(), closed_by = (select auth.uid())
  where id = p_day_id;
end;
$$;

create function public.sync_store_cash_day()
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.store_cash_days
  set status = 'closed', closed_at = auto_close_at
  where status = 'open' and auto_close_at is not null and auto_close_at <= now();
end;
$$;

revoke all on function public.create_store_cash_day(), public.start_store_cash_day(uuid, time),
  public.close_store_cash_day(uuid), public.sync_store_cash_day() from public, anon;
grant execute on function public.create_store_cash_day(), public.start_store_cash_day(uuid, time),
  public.close_store_cash_day(uuid), public.sync_store_cash_day() to authenticated;

create function private.assign_store_cash_day()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  current_day public.store_cash_days%rowtype;
begin
  select * into current_day from public.store_cash_days
  where status = 'open' and (auto_close_at is null or auto_close_at > now())
  for share;
  if not found then
    raise exception 'O caixa está fechado para novos pedidos.' using errcode = 'P0001';
  end if;
  new.cash_day_id := current_day.id;
  select full_name into new.buyer_name from public.profiles where id = new.buyer_id;
  return new;
end;
$$;
create trigger store_orders_assign_cash_day before insert on public.store_orders
for each row execute function private.assign_store_cash_day();

create function private.guard_store_cash_day_product()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  assigned_day uuid;
begin
  select cash_day_id into assigned_day from public.store_orders where id = new.order_id;
  if assigned_day is null or not exists (
    select 1 from public.store_cash_day_products
    where cash_day_id = assigned_day and product_id = new.product_id
  ) then
    raise exception 'Este produto não está disponível no caixa de hoje.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger store_order_items_guard_cash_day before insert on public.store_order_items
for each row execute function private.guard_store_cash_day_product();

create function private.guard_store_payment_method()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 1 and (
    new.cash_day_id is distinct from old.cash_day_id
    or new.buyer_id is distinct from old.buyer_id
    or new.buyer_name is distinct from old.buyer_name
    or new.total_amount is distinct from old.total_amount
  ) then
    raise exception 'Dados do pedido não podem ser alterados no caixa.' using errcode = '42501';
  end if;
  if new.status = 'ready_for_pickup' and old.status = 'awaiting_payment' then
    if not exists (select 1 from public.store_order_items where order_id = old.id) then
      raise exception 'O pedido ainda não possui itens.' using errcode = 'P0001';
    end if;
    if new.payment_method is null then
      raise exception 'Informe a forma de pagamento.' using errcode = 'P0001';
    end if;
    if old.cash_day_id is not null and not exists (
      select 1 from public.store_cash_days where id = old.cash_day_id and status = 'open'
        and (auto_close_at is null or auto_close_at > now())
    ) then
      raise exception 'O caixa deste pedido já foi encerrado.' using errcode = 'P0001';
    end if;
  elsif new.payment_method is distinct from old.payment_method then
    raise exception 'A forma de pagamento não pode ser alterada após a confirmação.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger store_orders_guard_payment_method before update on public.store_orders
for each row execute function private.guard_store_payment_method();

-- New orders and confirmations stop at the configured instant. This job persists
-- the closed status even when nobody has the app open at that time.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('ceda-close-cash-days', '*/5 * * * *', 'select public.sync_store_cash_day()');
