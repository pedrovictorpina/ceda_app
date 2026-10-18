begin;
select plan(8);
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('95000000-0000-0000-0000-000000000001', 'agenda-manager@usability.test', '{"roles":["administrator"]}', '{}');
insert into public.profiles (id, full_name, email) values
  ('95000000-0000-0000-0000-000000000001', 'Agenda Manager', 'agenda-manager@usability.test');
select set_config('request.jwt.claims', '{"sub":"95000000-0000-0000-0000-000000000001","app_metadata":{"roles":["administrator"]}}', true);
insert into public.communities(id, name, visibility, created_by) values
  ('96000000-0000-0000-0000-000000000001', 'Private agenda', 'private', '95000000-0000-0000-0000-000000000001');
insert into public.events(id, title, kind, starts_at, responsible_id, public_visibility, community_id, cancelled_at) values
  ('97000000-0000-0000-0000-000000000001', 'Public service', 'service', now() + interval '1 day', '95000000-0000-0000-0000-000000000001', true, null, null),
  ('97000000-0000-0000-0000-000000000002', 'Members service', 'service', now() + interval '1 day', '95000000-0000-0000-0000-000000000001', false, null, null),
  ('97000000-0000-0000-0000-000000000003', 'Cancelled service', 'service', now() + interval '1 day', '95000000-0000-0000-0000-000000000001', true, null, now()),
  ('97000000-0000-0000-0000-000000000004', 'Private group service', 'service', now() + interval '1 day', '95000000-0000-0000-0000-000000000001', true, '96000000-0000-0000-0000-000000000001', null),
  ('97000000-0000-0000-0000-000000000005', 'Other event', 'activity', now() + interval '1 day', '95000000-0000-0000-0000-000000000001', true, null, null);
reset role;
select set_config('request.jwt.claims', '{}', true);
set local role anon;
select is((select count(*)::integer from public.events), 1, 'visitors see only an explicitly public service without private links');
select is((select title from public.events), 'Public service', 'public event columns are readable');
select is((select count(*)::integer from public.events where community_id is not null or ministry_id is not null), 0, 'visitors cannot read private relationship identifiers');
select throws_ok($$select responsible_id from public.events$$, '42501', null, 'responsible identity is not exposed to visitors');
select throws_ok($$select * from public.events$$, '42501', null, 'wildcard access cannot bypass column grants');
select throws_ok($$delete from public.events$$, '42501', null, 'visitors cannot modify the agenda');
reset role;
select set_config('request.jwt.claims', '{"sub":"95000000-0000-0000-0000-000000000001","app_metadata":{"roles":["administrator"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.events), 5, 'management retains its authorized full agenda');
select is((select count(*)::integer from public.events where public_visibility and kind = 'service' and community_id is null and ministry_id is null and cancelled_at is null), 1, 'the public query stays restricted when a manager is signed in');
reset role;
select * from finish();
rollback;
