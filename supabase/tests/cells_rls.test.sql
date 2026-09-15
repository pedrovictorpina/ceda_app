begin;
select plan(34);

select has_table('public', 'cells', 'cells exists');
select has_table('public', 'cell_addresses', 'private cell addresses exist');
select has_table('public', 'cell_leaders', 'cell leaders exist');
select has_table('public', 'cell_invitations', 'cell invitations exist');
select has_table('public', 'cell_announcements', 'cell announcements exist');
select has_table('public', 'cell_polls', 'cell polls exist');
select has_table('public', 'cell_poll_options', 'cell poll options exist');
select has_table('public', 'cell_poll_votes', 'cell votes exist');

select is(
  (
    select count(*)::integer
    from pg_class table_class
    join pg_namespace namespace on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname in ('cells', 'cell_addresses', 'cell_leaders', 'cell_invitations', 'cell_announcements', 'cell_polls', 'cell_poll_options', 'cell_poll_votes')
      and table_class.relrowsecurity
  ),
  8,
  'all cell tables use RLS'
);

select is(
  (
    select count(*)::integer
    from pg_proc function_definition
    join pg_namespace namespace on namespace.oid = function_definition.pronamespace
    where namespace.nspname = 'public'
      and function_definition.proname in (
        'current_user_leads_cell', 'current_user_is_cell_member', 'touch_cell_record',
        'guard_cell_community_change', 'guard_cell_leadership', 'guard_cell_invitation_change',
        'accept_cell_invitation', 'guard_cell_announcement_change', 'notify_cell_announcement',
        'guard_cell_poll_change', 'create_cell'
      )
      and not function_definition.prosecdef
  ),
  11,
  'every cell helper and trigger is security invoker'
);

select has_column('public', 'notifications', 'source_cell_id', 'notifications identify their internal cell source');
select col_is_unique('public', 'profiles', 'email_normalized', 'registered e-mails are normalized and unique for invitations');
select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name like 'cell%'
  ),
  0,
  'anonymous users receive no cell table privileges'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@cells.test', '', now(), '{"roles":["administrator"]}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leader@cells.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@cells.test', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@cells.test', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, full_name, email) values
  ('10000000-0000-0000-0000-000000000001', 'Manager Cells', 'manager@cells.test'),
  ('10000000-0000-0000-0000-000000000002', 'Leader Cells', 'leader@cells.test'),
  ('10000000-0000-0000-0000-000000000003', 'Member Cells', 'member@cells.test'),
  ('10000000-0000-0000-0000-000000000004', 'Outsider Cells', 'outsider@cells.test');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","email":"manager@cells.test","role":"authenticated","app_metadata":{"roles":["administrator"]}}', true);
set local role authenticated;

select lives_ok(
  $$select public.create_cell('Célula RLS', 'Teste de segurança', 3::smallint, '20:00'::time, array['10000000-0000-0000-0000-000000000002'::uuid])$$,
  'a manager creates a cell with a registered initial leader'
);
select is((select count(*)::integer from public.cell_leaders), 1, 'the initial leader is assigned');

insert into public.cell_addresses (cell_id, address_line, city, region, postal_code, updated_by)
select id, 'Rua Privada, 123', 'São Paulo', 'SP', '00000-000', '10000000-0000-0000-0000-000000000001'
from public.communities where name = 'Célula RLS';

select throws_ok(
  $$delete from public.cell_leaders where user_id = '10000000-0000-0000-0000-000000000002'$$,
  'P0001',
  'A cell must keep at least one leader.',
  'the final leader cannot be removed'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","email":"outsider@cells.test","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.cells), 0, 'an outsider cannot see private cells');
select is((select count(*)::integer from public.cell_addresses), 0, 'an outsider cannot see private addresses');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","email":"leader@cells.test","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.cell_invitations (cell_id, invitee_email, invited_by) select id, 'member@cells.test', '10000000-0000-0000-0000-000000000002' from public.communities where name = 'Célula RLS'$$,
  'a leader invites an already registered user'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","email":"member@cells.test","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.cells), 1, 'an invited user sees the pending cell card');
select is((select count(*)::integer from public.cell_addresses), 0, 'an invited user cannot see the address');
select lives_ok(
  $$update public.cell_invitations set status = 'accepted' where invitee_email = 'member@cells.test'$$,
  'the invited user accepts their own invitation'
);
select is((select count(*)::integer from public.community_memberships where user_id = (select auth.uid()) and status = 'approved'), 1, 'acceptance creates an approved membership');
select is((select count(*)::integer from public.cell_addresses), 1, 'an approved member can see the private address');

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","email":"leader@cells.test","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.cell_leaders (cell_id, user_id, assigned_by) select id, '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002' from public.communities where name = 'Célula RLS'$$,
  'P0001',
  'Only administrators or pastors can assign cell leaders.',
  'leaders cannot assign themselves or escalate another user'
);
select lives_ok(
  $$insert into public.cell_announcements (cell_id, title, body, created_by) select id, 'Aviso interno', 'Mensagem somente para a célula.', '10000000-0000-0000-0000-000000000002' from public.communities where name = 'Célula RLS'$$,
  'a leader creates an announcement draft'
);
select lives_ok(
  $$update public.cell_announcements set status = 'published' where title = 'Aviso interno'$$,
  'a leader publishes an announcement'
);

reset role;
select is((select count(*)::integer from public.notifications where source_cell_id is not null), 2, 'publication creates one internal notification per approved member');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","email":"leader@cells.test","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.cell_polls (cell_id, question, created_by) select id, 'Qual horário?', '10000000-0000-0000-0000-000000000002' from public.communities where name = 'Célula RLS'$$,
  'a leader creates a poll draft'
);
select lives_ok(
  $$insert into public.cell_poll_options (poll_id, label, position) select id, '19h', 0 from public.cell_polls where question = 'Qual horário?' union all select id, '20h', 1 from public.cell_polls where question = 'Qual horário?'$$,
  'a leader adds at least two valid poll options'
);
select lives_ok(
  $$update public.cell_polls set status = 'published' where question = 'Qual horário?'$$,
  'a leader publishes a poll with two options'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","email":"member@cells.test","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.cell_poll_votes (poll_id, option_id, user_id) select poll.id, option.id, '10000000-0000-0000-0000-000000000003' from public.cell_polls poll join public.cell_poll_options option on option.poll_id = poll.id where poll.question = 'Qual horário?' and option.position = 0$$,
  'an approved member votes for a valid option in a published poll'
);
select is((select count(*)::integer from public.cell_poll_votes where user_id = (select auth.uid())), 1, 'the member has one vote in the poll');
select throws_ok(
  $$insert into public.cell_poll_votes (poll_id, option_id, user_id) select poll.id, option.id, '10000000-0000-0000-0000-000000000003' from public.cell_polls poll join public.cell_poll_options option on option.poll_id = poll.id where poll.question = 'Qual horário?' and option.position = 1$$,
  '23505',
  'duplicate key value violates unique constraint "cell_poll_votes_pkey"',
  'the database rejects a second vote in the same poll'
);

select * from finish();
rollback;
