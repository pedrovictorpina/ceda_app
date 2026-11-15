-- Preserve the globally unique order_number and all historical display numbers.
alter table public.store_orders add column daily_order_number bigint
  check (daily_order_number > 0);
alter table public.store_orders add column daily_order_date date;

create unique index store_orders_cash_day_daily_number_idx
  on public.store_orders (cash_day_id, daily_order_number)
  where daily_order_number is not null;

-- The counter is private; the atomic upsert serializes concurrent orders.
create table private.store_order_daily_counters (
  cash_day_id uuid primary key references public.store_cash_days(id),
  last_number bigint not null check (last_number > 0)
);
revoke all on private.store_order_daily_counters from public, anon, authenticated;

create function private.assign_store_order_daily_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cash_day_id is null then
    raise exception 'O pedido deve pertencer a um dia de caixa.';
  end if;
  select business_date into strict new.daily_order_date
  from public.store_cash_days where id = new.cash_day_id;
  insert into private.store_order_daily_counters (cash_day_id, last_number)
  values (new.cash_day_id, coalesce((
    select max(coalesce(o.daily_order_number, o.order_number))
    from public.store_orders o where o.cash_day_id = new.cash_day_id
  ), 0) + 1)
  on conflict (cash_day_id) do update
    set last_number = private.store_order_daily_counters.last_number + 1
  returning last_number into new.daily_order_number;
  return new;
end;
$$;

create trigger store_orders_number_within_cash_day before insert on public.store_orders
for each row execute function private.assign_store_order_daily_number();

create function private.guard_store_order_daily_number()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.daily_order_number is distinct from old.daily_order_number
     or new.daily_order_date is distinct from old.daily_order_date
     or new.cash_day_id is distinct from old.cash_day_id then
    raise exception 'A numeração e o dia de caixa do pedido não podem ser alterados.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger store_orders_guard_daily_number before update on public.store_orders
for each row execute function private.guard_store_order_daily_number();
