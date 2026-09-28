begin;
select plan(38);

select has_table('public', 'children_classes', 'classes table exists');
select has_table('public', 'children_class_teachers', 'class teachers table exists');
select has_table('public', 'children_class_enrollments', 'enrollments table exists');
select has_table('public', 'children_checkins', 'check-ins table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.children_checkins'::regclass), 'check-ins use RLS');
select ok(not has_table_privilege('anon', 'public.children_checkins', 'select'), 'anonymous users cannot read check-ins');
select ok(not has_table_privilege('authenticated', 'public.children_checkins', 'insert'), 'check-ins are written only through RPCs');
select is((select public from storage.buckets where id = 'child-photos'), false, 'child photos bucket is private');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'parent@kids.test', '', now(), '{"roles":["member"]}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@kids.test', '', now(), '{"roles":["member"]}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher@kids.test', '', now(), '{"roles":["member","teacher"]}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher2@kids.test', '', now(), '{"roles":["member","teacher"]}', '{}', now(), now());

insert into public.profiles (id, full_name, email) values
  ('50000000-0000-0000-0000-000000000001', 'Parent Kids', 'parent@kids.test'),
  ('50000000-0000-0000-0000-000000000002', 'Other Kids', 'other@kids.test'),
  ('50000000-0000-0000-0000-000000000003', 'Teacher Kids', 'teacher@kids.test'),
  ('50000000-0000-0000-0000-000000000004', 'Second Teacher', 'teacher2@kids.test');

-- Parent registers a child without administrator approval.
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select lives_ok(
  $$select public.register_child('Ana Sementinha', (current_date - interval '5 years')::date, null)$$,
  'a member can register their own child'
);
select is((select count(*)::integer from public.children), 1, 'the guardian sees the registered child');
select is((select count(*)::integer from public.child_guardians where guardian_id = '50000000-0000-0000-0000-000000000001'), 1, 'the creator becomes a guardian');
select throws_ok(
  $$select public.register_child('Futuro', (current_date + 2)::date, null)$$,
  '22023', null, 'a birth date in the future is rejected'
);
select throws_ok(
  $$insert into public.children_classes (name, min_age, max_age, created_by) values ('Turma Pai', 3, 5, '50000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a parent cannot create classes'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.children), 0, 'another member cannot see the child');
select throws_ok(
  $$select public.remove_child((select child_id from public.child_guardians limit 1))$$,
  '42501', null, 'another member cannot remove the child'
);

-- Teacher organises a class.
reset role;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"roles":["member","teacher"]}}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.children_classes (id, name, min_age, max_age, created_by) values ('50000000-0000-0000-0000-000000000010', 'Jardim', 3, 5, '50000000-0000-0000-0000-000000000003')$$,
  'a teacher can create a class'
);
select is((select count(*)::integer from public.children_class_teachers where class_id = '50000000-0000-0000-0000-000000000010'), 1, 'the creator teaches the class');
select throws_ok(
  $$insert into public.children_classes (name, min_age, max_age, created_by) values ('Invertida', 6, 4, '50000000-0000-0000-0000-000000000003')$$,
  '23514', null, 'the minimum age cannot exceed the maximum age'
);
select is((select count(*)::integer from public.children where full_name ilike '%ana%'), 1, 'a teacher can search registered children');
select lives_ok(
  $$insert into public.children_class_enrollments (class_id, child_id, added_by) select '50000000-0000-0000-0000-000000000010', id, '50000000-0000-0000-0000-000000000003' from public.children$$,
  'a teacher can add a child to a class'
);

-- Parent checks the child in.
reset role;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.children_classes), 1, 'the guardian sees the child class');
select lives_ok(
  $$select public.check_in_child((select id from public.children limit 1), '50000000-0000-0000-0000-000000000010')$$,
  'the guardian can check the child in'
);
select throws_ok(
  $$select public.check_in_child((select id from public.children limit 1), '50000000-0000-0000-0000-000000000010')$$,
  'P0001', null, 'a second open check-in is rejected'
);

reset role;
create temporary table test_checkin on commit drop as
  select id from public.children_checkins where status = 'checked_in';
grant select on test_checkin to authenticated;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"roles":["member","teacher"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.children_checkins), 0, 'a teacher outside the class does not see its roster');
select throws_ok(
  $$select public.send_child_alert((select id from test_checkin), 'crying', null)$$,
  '42501', null, 'a teacher outside the class cannot alert its guardians'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"roles":["member","teacher"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.children_checkins where status = 'checked_in'), 1, 'the class teacher sees the live roster');
select is(
  (select public.send_child_alert((select id from public.children_checkins limit 1), 'needs_you', 'Traga a mamadeira')),
  1,
  'the class teacher alerts every guardian'
);
select throws_ok(
  $$select public.send_child_alert((select id from public.children_checkins limit 1), 'crying', null)$$,
  'P0001', null, 'alerts are rate limited per check-in'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.children_alerts where acknowledged_at is null), 1, 'the guardian receives the alert');
select is((select count(*)::integer from public.notifications where deep_link = '/sementinhas'), 1, 'the alert reaches the notification inbox');
select throws_ok(
  $$update public.children_alerts set message = 'forjado'$$,
  '42501', null, 'guardians cannot rewrite alerts'
);
select lives_ok(
  $$select public.acknowledge_child_alert((select id from public.children_alerts limit 1))$$,
  'the guardian acknowledges the alert'
);
select lives_ok(
  $$select public.check_out_child((select id from public.children_checkins where status = 'checked_in' limit 1))$$,
  'the guardian checks the child out'
);

-- A check-in forgotten on a previous day expires on the next check-in.
reset role;
insert into public.children_checkins (child_id, class_id, checked_in_by, checked_in_at)
select id, '50000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000001', now() - interval '3 days'
from public.children;
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select lives_ok(
  $$select public.check_in_child((select id from public.children limit 1), '50000000-0000-0000-0000-000000000010')$$,
  'a stale check-in does not block a new one'
);
select throws_ok(
  $$select public.remove_child((select id from public.children limit 1))$$,
  'P0001', null, 'a child in the classroom cannot be removed'
);
select lives_ok(
  $$select public.check_out_child((select id from public.children_checkins where status = 'checked_in' limit 1))$$,
  'the guardian checks the child out again'
);
select is(
  (select (public.remove_child((select id from public.children limit 1)) ->> 'deleted')::boolean),
  true,
  'the only guardian removes the child profile'
);

reset role;
select is(
  (select count(*)::integer from public.children_audit_log where action in ('child_registered', 'checked_in', 'checked_out', 'alert_sent', 'alert_acknowledged', 'child_removed')),
  8,
  'check-ins, alerts and removal are audited'
);

select * from finish();
rollback;
