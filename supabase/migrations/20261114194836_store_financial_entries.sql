create table public.store_financial_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  kind text not null check (kind in ('expense', 'donation')),
  description text not null check (char_length(trim(description)) between 1 and 160),
  amount numeric(12,2) not null check (amount > 0 and amount <> 'NaN'::numeric),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  voided_by uuid references public.profiles(id),
  voided_at timestamptz,
  check ((voided_at is null) = (voided_by is null))
);
create index store_financial_entries_date_idx on public.store_financial_entries (entry_date, id);
alter table public.store_financial_entries enable row level security;
revoke all on public.store_financial_entries from public, anon, authenticated;
grant select, insert, update on public.store_financial_entries to authenticated;
create policy store_financial_entries_read on public.store_financial_entries for select to authenticated
  using (public.current_user_can_operate_store());
create policy store_financial_entries_insert on public.store_financial_entries for insert to authenticated
  with check (public.current_user_can_operate_store() and created_by = (select auth.uid()) and voided_at is null and voided_by is null);
create policy store_financial_entries_void on public.store_financial_entries for update to authenticated
  using (public.current_user_can_operate_store()) with check (public.current_user_can_operate_store());

create function private.guard_store_financial_entry()
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
  if old.voided_at is not null or new.voided_at is null
    or new.id is distinct from old.id or new.entry_date is distinct from old.entry_date
    or new.kind is distinct from old.kind or new.description is distinct from old.description
    or new.amount is distinct from old.amount or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'O lançamento só pode ser estornado; registre outro para corrigir.' using errcode = '42501';
  end if;
  new.voided_by := (select auth.uid());
  new.voided_at := now();
  return new;
end;
$$;
create trigger store_financial_entries_guard before insert or update on public.store_financial_entries
  for each row execute function private.guard_store_financial_entry();
