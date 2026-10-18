begin;
select plan(25);

select has_table('public', 'saved_messages', 'personal message bookmarks exist');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager@usability.test', '', now(), '{"roles":["administrator"]}', '{}', now(), now()),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@usability.test', '', now(), '{}', '{}', now(), now()),
  ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@usability.test', '', now(), '{}', '{}', now(), now());
insert into public.profiles (id, full_name, email) values
  ('90000000-0000-0000-0000-000000000001', 'Manager Usability', 'manager@usability.test'),
  ('90000000-0000-0000-0000-000000000002', 'Member Usability', 'member@usability.test'),
  ('90000000-0000-0000-0000-000000000003', 'Other Usability', 'other@usability.test');
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["administrator"]}}', true);
insert into public.daily_messages (id, title, content, author_id, message_date, content_type, status, publish_at) values
  ('91000000-0000-0000-0000-000000000001', 'Published word', 'Content', '90000000-0000-0000-0000-000000000001', current_date, 'word_of_day', 'published', now() - interval '1 day'),
  ('91000000-0000-0000-0000-000000000002', 'Draft word', 'Content', '90000000-0000-0000-0000-000000000001', current_date, 'word_of_day', 'draft', null),
  ('91000000-0000-0000-0000-000000000003', 'Future word', 'Content', '90000000-0000-0000-0000-000000000001', current_date, 'word_of_day', 'published', now() + interval '1 day'),
  ('91000000-0000-0000-0000-000000000004', 'News', 'Content', '90000000-0000-0000-0000-000000000001', current_date, 'news', 'published', null);
insert into public.saved_messages(user_id, message_id) values ('90000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000001');
insert into public.communities(id, name, visibility, created_by) values ('92000000-0000-0000-0000-000000000001', 'Private group', 'private', '90000000-0000-0000-0000-000000000001');
insert into public.posts(id, author_id, community_id, title, description) values
  ('93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'Private post', 'Content'),
  ('93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', null, 'Member post', 'Content');
insert into public.post_comments(id, post_id, author_id, content) values ('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'Own comment');
insert into public.post_likes(post_id, user_id) values
  ('93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001'),
  ('93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003');

set local role anon;
select throws_ok($$select * from public.saved_messages$$, '42501', null, 'anonymous users cannot read bookmarks');
reset role;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select lives_ok($$insert into public.saved_messages(user_id, message_id) values ('90000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000001')$$, 'a member bookmarks a published word');
select throws_ok($$insert into public.saved_messages(user_id, message_id) values ('90000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000002')$$, '42501', null, 'draft words cannot be bookmarked');
select throws_ok($$insert into public.saved_messages(user_id, message_id) values ('90000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000003')$$, '42501', null, 'future words cannot be bookmarked early');
select throws_ok($$insert into public.saved_messages(user_id, message_id) values ('90000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000004')$$, '42501', null, 'news cannot bypass the word bookmark contract');
select throws_ok($$insert into public.saved_messages(user_id, message_id) values ('90000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001')$$, '42501', null, 'members cannot write another account bookmarks');
select is((select count(*)::integer from public.saved_messages), 1, 'members see only their own bookmarks');
with removed as (delete from public.saved_messages where user_id = '90000000-0000-0000-0000-000000000003' returning *)
select is((select count(*)::integer from removed), 0, 'members cannot delete another account bookmarks');
select is((select count(*)::integer from public.posts where id = '93000000-0000-0000-0000-000000000001'), 0, 'private posts remain hidden');
select is((select count(*)::integer from public.post_likes where post_id = '93000000-0000-0000-0000-000000000001'), 0, 'private post reactions do not leak');
select throws_ok($$insert into public.post_likes(post_id, user_id) values ('93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002')$$, '42501', null, 'members cannot like hidden posts');
select throws_ok($$insert into public.post_comments(post_id, author_id, content) values ('93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002', 'Hidden comment')$$, '42501', null, 'members cannot comment on hidden posts');
select throws_ok($$insert into public.posts(author_id, community_id, title, description) values ('90000000-0000-0000-0000-000000000002', '92000000-0000-0000-0000-000000000001', 'Hidden post', 'Content')$$, '42501', null, 'members cannot publish to hidden groups');
select throws_ok($$update public.posts set community_id = '92000000-0000-0000-0000-000000000001' where id = '93000000-0000-0000-0000-000000000002'$$, '42501', null, 'moving an owned post cannot bypass destination privacy');
select throws_ok($$update public.post_comments set post_id = '93000000-0000-0000-0000-000000000001' where id = '94000000-0000-0000-0000-000000000001'$$, '42501', null, 'moving an owned comment cannot bypass destination privacy');
select lives_ok($$insert into public.post_likes(post_id, user_id) values ('93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002')$$, 'members can like visible posts');
select lives_ok($$insert into public.post_comments(post_id, author_id, content) values ('93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'New comment')$$, 'members can comment on visible posts');
select is((select count(*)::integer from public.post_likes where post_id = '93000000-0000-0000-0000-000000000002'), 2, 'visible post counts include other members reactions');
select is((select count(*)::integer from public.post_comments where post_id = '93000000-0000-0000-0000-000000000002'), 2, 'visible post counts include confirmed comments');
select throws_ok($$insert into public.posts(author_id, title, description) values ('90000000-0000-0000-0000-000000000002', ' ', 'Content')$$, '23514', null, 'empty publication titles are rejected');
select throws_ok($$insert into public.post_comments(post_id, author_id, content) values ('93000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', ' ')$$, '23514', null, 'empty comments are rejected');
with removed as (delete from public.saved_messages where user_id = (select auth.uid()) returning *)
select is((select count(*)::integer from removed), 1, 'a member can remove their own bookmark');
reset role;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select is((select count(*)::integer from public.saved_messages where user_id = '90000000-0000-0000-0000-000000000002'), 0, 'another account cannot read the original list');
select is((select count(*)::integer from public.saved_messages), 1, 'the other account bookmark remains intact');
reset role;
select * from finish();
rollback;
