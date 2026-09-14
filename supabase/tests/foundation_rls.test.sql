begin;
select plan(10);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'children', 'children exists');
select has_table('public', 'prayer_requests', 'prayer requests exist');
select has_table('public', 'account_deletion_requests', 'deletion requests exist');
select is((select relrowsecurity from pg_class where oid = 'public.children'::regclass), true, 'children has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true, 'profiles has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.prayer_requests'::regclass), true, 'prayer requests have RLS');
select is((select prosecdef from pg_proc where oid = 'public.current_user_has_role(public.system_role)'::regprocedure), false, 'role helper is security invoker');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'children'), 4, 'children has explicit policies per operation');
select is((select count(*)::integer from information_schema.tables t where t.table_schema = 'public' and t.table_type = 'BASE TABLE' and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = t.table_schema and c.relname = t.table_name and c.relrowsecurity)), 0, 'all public tables use RLS');

select * from finish();
rollback;
