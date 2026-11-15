alter table public.store_cash_days drop constraint store_cash_days_business_date_key;

create or replace function private.assign_store_order_daily_number()
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
    from public.store_orders o
    join public.store_cash_days d on d.id = o.cash_day_id
    where d.business_date = new.daily_order_date
  ), 0) + 1)
  on conflict (cash_day_id) do update
    set last_number = private.store_order_daily_counters.last_number + 1
  returning last_number into new.daily_order_number;
  return new;
end;
$$;
