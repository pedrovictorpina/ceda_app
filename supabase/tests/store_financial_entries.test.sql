begin;
select plan(9);
insert into auth.users (id, email, raw_app_meta_data) values
 ('78000000-0000-4000-8000-000000000001', 'finance-operator@example.test', '{"roles":["cashier"]}'),
 ('78000000-0000-4000-8000-000000000002', 'finance-member@example.test', '{"roles":["member"]}');
insert into public.profiles (id, full_name, email) values
 ('78000000-0000-4000-8000-000000000001', 'Operador', 'finance-operator@example.test'),
 ('78000000-0000-4000-8000-000000000002', 'Membro', 'finance-member@example.test');
select set_config('request.jwt.claims', '{"sub":"78000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"roles":["cashier"]}}', true);
set local role authenticated;
select lives_ok($$insert into public.store_financial_entries (id, entry_date, kind, description, amount, created_by)
 values ('78000000-0000-4000-8000-000000000003', '2026-11-14', 'donation', ' Doação ', 10.50, '78000000-0000-4000-8000-000000000001')$$, 'operator can record donation');
select throws_ok($$insert into public.store_financial_entries (entry_date, kind, description, amount, created_by)
 values ('2026-11-14', 'expense', 'Inválido', 'NaN'::numeric, '78000000-0000-4000-8000-000000000001')$$, '23514', null, 'non-finite numeric amounts are rejected');
select is((select description from public.store_financial_entries where id='78000000-0000-4000-8000-000000000003'), 'Doação', 'description is trimmed');
select throws_ok($$update public.store_financial_entries set amount=1 where id='78000000-0000-4000-8000-000000000003'$$, '42501', null, 'entries cannot be rewritten');
select lives_ok($$update public.store_financial_entries set voided_at=now() where id='78000000-0000-4000-8000-000000000003'$$, 'operator can void an entry');
select is((select voided_by from public.store_financial_entries where id='78000000-0000-4000-8000-000000000003'), '78000000-0000-4000-8000-000000000001'::uuid, 'void records operator');
select throws_ok($$delete from public.store_financial_entries where id='78000000-0000-4000-8000-000000000003'$$, '42501', null, 'history cannot be deleted by operator');
select set_config('request.jwt.claims', '{"sub":"78000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
select is((select count(*)::integer from public.store_financial_entries), 0, 'member cannot view financial entries');
select throws_ok($$insert into public.store_financial_entries (entry_date, kind, description, amount, created_by)
 values ('2026-11-14', 'expense', 'Teste', 1, '78000000-0000-4000-8000-000000000002')$$, '42501', null, 'member cannot insert financial entries');
select * from finish();
rollback;
