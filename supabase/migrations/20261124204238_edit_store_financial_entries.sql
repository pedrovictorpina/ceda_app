grant delete on public.store_financial_entries to authenticated;
create policy store_financial_entries_delete on public.store_financial_entries for delete to authenticated using (public.current_user_can_operate_store());
create or replace function private.guard_store_financial_entry()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.description := trim(new.description);
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.voided_by := null;
    new.voided_at := null;
    return new;
  end if;
  if new.id is distinct from old.id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'Não é permitido alterar a identificação do lançamento.' using errcode = '42501';
  end if;
  new.description := trim(new.description);
  if old.voided_at is null and new.voided_at is not null then
    new.voided_by := (select auth.uid());
    new.voided_at := now();
  elsif new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by then
    raise exception 'Não é permitido alterar o estorno do lançamento.' using errcode = '42501';
  end if;
  return new;
end;
$$;
