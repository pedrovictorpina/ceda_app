begin;
select plan(8);

select has_table('public', 'administrative_audit_log', 'administrative audit table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.administrative_audit_log'::regclass),
  'administrative audit table uses RLS'
);
select ok(
  not has_table_privilege('anon', 'public.administrative_audit_log', 'select,insert,update,delete')
    and not has_table_privilege('authenticated', 'public.administrative_audit_log', 'insert,update,delete'),
  'clients cannot write audit entries directly'
);
select ok(
  (select prosecdef from pg_proc where oid = 'private.log_administrative_change()'::regprocedure),
  'audit trigger function is an internal security definer'
);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@audit.test', '', now(), '{"roles":["administrator"]}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@audit.test', '', now(), '{}', '{}', now(), now());

insert into public.profiles (id, full_name, email) values
  ('20000000-0000-0000-0000-000000000001', 'Manager Audit', 'manager@audit.test'),
  ('20000000-0000-0000-0000-000000000002', 'Member Audit', 'member@audit.test');

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","email":"manager@audit.test","role":"authenticated","app_metadata":{"roles":["administrator"]}}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.daily_messages (title, content, author_id, message_date, status, content_type, slug)
    values ('Auditoria', 'Conteúdo de teste', '20000000-0000-0000-0000-000000000001', current_date, 'draft', 'word_of_day', 'auditoria-teste')$$,
  'manager content creation writes successfully'
);
select is(
  (select count(*)::integer from public.administrative_audit_log where action = 'content_created'),
  1,
  'content creation is audited'
);

insert into public.communities (name, created_by) values ('Comunidade Audit', '20000000-0000-0000-0000-000000000001');
insert into public.community_memberships (community_id, user_id, status)
select id, '20000000-0000-0000-0000-000000000002', 'pending' from public.communities where name = 'Comunidade Audit';

select lives_ok(
  $$update public.community_memberships
      set status = 'approved', reviewed_by = '20000000-0000-0000-0000-000000000001', reviewed_at = now()
    where user_id = '20000000-0000-0000-0000-000000000002'$$,
  'manager membership review writes successfully'
);
select is(
  (select count(*)::integer from public.administrative_audit_log where action = 'membership_approved'),
  1,
  'membership approval is audited'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","email":"member@audit.test","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is(
  (select count(*)::integer from public.administrative_audit_log),
  0,
  'non-manager cannot read audit events'
);

select * from finish();
rollback;
