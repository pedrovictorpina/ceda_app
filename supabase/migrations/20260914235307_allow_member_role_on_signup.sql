grant insert on table public.user_system_roles to authenticated;

create policy roles_insert_self_as_member
on public.user_system_roles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and granted_by is null
);
