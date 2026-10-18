begin;

-- One store role, including sessions issued before the migration. All existing
-- policies and order guards continue to enforce their original state sequence.
create or replace function public.current_user_has_role(required_role public.system_role)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    case when required_role in ('cashier', 'counter') then
      (select auth.jwt() -> 'app_metadata' -> 'roles' ?| array['cashier', 'counter'])
    else
      (select auth.jwt() -> 'app_metadata' -> 'roles' ? required_role::text)
    end,
    false
  )
$$;

revoke all on function public.current_user_has_role(public.system_role) from public;
grant execute on function public.current_user_has_role(public.system_role) to authenticated;

-- Retain both persisted aliases while older clients still read the two values
-- separately. Only existing store operators qualify; other privileges are kept.
with operators as (
  select user_id from public.user_system_roles where role in ('cashier', 'counter')
  union
  select id from auth.users where raw_app_meta_data -> 'roles' ?| array['cashier', 'counter']
), existing_grants as (
  select distinct on (user_id) user_id, granted_by, granted_at
  from public.user_system_roles
  where role in ('cashier', 'counter')
  order by user_id, granted_at, role
)
insert into public.user_system_roles (user_id, role, granted_by, granted_at)
select o.user_id, r.role, g.granted_by, coalesce(g.granted_at, now())
from operators o
join public.profiles p on p.id = o.user_id
cross join (values ('cashier'::public.system_role), ('counter'::public.system_role)) r(role)
left join existing_grants g on g.user_id = o.user_id
on conflict (user_id, role) do nothing;

update auth.users u
set raw_app_meta_data = jsonb_set(coalesce(u.raw_app_meta_data, '{}'::jsonb), '{roles}', (
  select jsonb_agg(role order by role)
  from (
    select value as role from jsonb_array_elements(
      case when jsonb_typeof(u.raw_app_meta_data -> 'roles') = 'array'
        then u.raw_app_meta_data -> 'roles' else '[]'::jsonb end
    )
    union select '"cashier"'::jsonb
    union select '"counter"'::jsonb
  ) roles
)), updated_at = now()
where (
  exists (select 1 from public.user_system_roles r where r.user_id = u.id and r.role in ('cashier', 'counter'))
  or u.raw_app_meta_data -> 'roles' ?| array['cashier', 'counter']
)
and not coalesce(u.raw_app_meta_data -> 'roles' ?& array['cashier', 'counter'], false);

commit;
