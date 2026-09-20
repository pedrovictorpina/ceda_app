begin;
select plan(12);

select has_table('public', 'family_members', 'family members table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.family_members'::regclass),
  true,
  'family members table uses RLS'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public' and table_name = 'family_members'),
  0,
  'anonymous users have no family member privileges'
);
select is(
  (select array_agg(privilege_type order by privilege_type) from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'family_members'),
  array['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  'authenticated users receive required family member privileges'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@family.test', '', now(), '{}', '{}', now(), now()),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@family.test', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, full_name, email) values
  ('30000000-0000-0000-0000-000000000001', 'Family Owner', 'owner@family.test'),
  ('30000000-0000-0000-0000-000000000002', 'Other Member', 'other@family.test');

select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","email":"owner@family.test","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.family_members (owner_id, full_name, relationship, birth_date) values ('30000000-0000-0000-0000-000000000001', 'Ana da Família', 'Filha', '2015-04-20')$$,
  'a member can register a private family member'
);
select is((select count(*)::integer from public.family_members), 1, 'the owner can read their family member');
select throws_ok(
  $$insert into public.family_members (owner_id, full_name, relationship, birth_date) values ('30000000-0000-0000-0000-000000000002', 'Forbidden Member', 'Irmã', '2010-05-10')$$,
  '42501', null, 'a member cannot register a relative for another account'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000002","email":"other@family.test","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::integer from public.family_members), 0, 'another member cannot read a private family list');
select throws_ok(
  $$update public.family_members set full_name = 'Access Denied'$$,
  '42501', null, 'another member cannot update a private family member'
);
select throws_ok(
  $$delete from public.family_members$$,
  '42501', null, 'another member cannot delete a private family member'
);

reset role;
set local role anon;
select is((select count(*)::integer from public.family_members), 0, 'anonymous users cannot read family members');
select throws_ok(
  $$insert into public.family_members (owner_id, full_name, relationship, birth_date) values ('30000000-0000-0000-0000-000000000001', 'Anonymous Entry', 'Parente', '2010-01-01')$$,
  '42501', null, 'anonymous users cannot register family members'
);

select * from finish();
rollback;
