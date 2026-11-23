alter policy store_cash_day_products_insert on public.store_cash_day_products
with check (
  public.current_user_can_operate_store()
  and exists (
    select 1 from public.store_cash_days day
    where day.id = cash_day_id
      and day.status in ('preparing', 'open')
      and (day.auto_close_at is null or day.auto_close_at > now())
  )
);
