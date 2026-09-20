create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  relationship text not null check (char_length(trim(relationship)) between 2 and 60),
  birth_date date not null check (birth_date <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.family_members is 'Private household directory owned by one member profile.';
comment on column public.family_members.birth_date is 'Source for derived age; never persist age.';

create index family_members_owner_id_idx on public.family_members (owner_id);
create index family_members_owner_birthday_idx on public.family_members (owner_id, birth_date);

alter table public.family_members enable row level security;

revoke all on table public.family_members from anon, authenticated;
grant select, insert, update, delete on table public.family_members to authenticated;

create policy family_members_select_own
on public.family_members for select to authenticated
using (owner_id = (select auth.uid()));

create policy family_members_insert_own
on public.family_members for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy family_members_update_own
on public.family_members for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy family_members_delete_own
on public.family_members for delete to authenticated
using (owner_id = (select auth.uid()));

create function public.touch_family_member_updated_at()
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

create trigger family_members_touch_updated_at
before update on public.family_members
for each row execute function public.touch_family_member_updated_at();
