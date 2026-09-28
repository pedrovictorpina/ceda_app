begin;
select plan(18);

select has_column('public', 'profiles', 'birthday_greetings_opt_in', 'profiles store the birthday greetings consent');
select col_default_is('public', 'profiles', 'birthday_greetings_opt_in', 'false', 'birthday greetings consent defaults to false');
select ok(not has_function_privilege('anon', 'public.list_birthdays(text)', 'execute'), 'anonymous users cannot list birthdays');
select ok(has_function_privilege('authenticated', 'public.list_birthdays(text)', 'execute'), 'members can list birthdays');
select ok(not has_function_privilege('authenticated', 'private.birthdays_between(date, date)', 'execute'), 'members cannot call the private birthday query');

-- Regra de 29/02 e intervalos de período (inclui semana na virada do ano).
select is(private.observed_birthday('2000-02-29', 2027), date '2027-02-28', 'Feb 29 birthdays are celebrated on Feb 28 in common years');
select is(private.observed_birthday('2000-02-29', 2028), date '2028-02-29', 'Feb 29 birthdays keep their day in leap years');
select results_eq(
  $$select range_start, range_end from private.birthday_period_bounds('week', '2026-12-31')$$,
  $$values (date '2026-12-28', date '2027-01-03')$$,
  'the week runs Monday to Sunday and can cross the year'
);
select results_eq(
  $$select range_start, range_end from private.birthday_period_bounds('month', '2027-02-10')$$,
  $$values (date '2027-02-01', date '2027-02-28')$$,
  'the month covers its first to last day'
);
select throws_ok($$select * from private.birthday_period_bounds('year', current_date)$$, '22023', null, 'unknown periods are rejected');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'today@birthday.test', '', now(), '{}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'private@birthday.test', '', now(), '{}', '{}', now(), now()),
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'newyear@birthday.test', '', now(), '{}', '{}', now(), now());

-- 28 anos atrás mantém o alinhamento bissexto caso o teste rode em 29/02.
insert into public.profiles (id, full_name, email, birth_date, birthday_greetings_opt_in) values
  ('50000000-0000-0000-0000-000000000001', 'Aniversariante Hoje', 'today@birthday.test', ((now() at time zone 'America/Sao_Paulo')::date - interval '28 years')::date, true),
  ('50000000-0000-0000-0000-000000000002', 'Aniversariante Reservado', 'private@birthday.test', ((now() at time zone 'America/Sao_Paulo')::date - interval '28 years')::date, false),
  ('50000000-0000-0000-0000-000000000003', 'Aniversariante Ano Novo', 'newyear@birthday.test', '1990-01-02', true);

select results_eq(
  $$select full_name, celebration_date from private.birthdays_between('2026-12-28', '2027-01-03') where id = '50000000-0000-0000-0000-000000000003'$$,
  $$values ('Aniversariante Ano Novo'::text, date '2027-01-02')$$,
  'a week crossing the year finds January birthdays in the next year'
);

select throws_ok(
  $$update public.profiles set birth_date = current_date + 1 where id = '50000000-0000-0000-0000-000000000003'$$,
  '23514', null, 'birth dates in the future are rejected'
);
select throws_ok(
  $$update public.profiles set birth_date = '1899-12-31' where id = '50000000-0000-0000-0000-000000000003'$$,
  '23514', null, 'birth dates before 1900 are rejected'
);

select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select is(
  (select array_agg(full_name) from public.list_birthdays('today')),
  array['Aniversariante Hoje']::text[],
  'only opted-in members appear in today''s birthdays'
);
select is(
  (select count(*)::integer from public.profiles where id = '50000000-0000-0000-0000-000000000001'),
  0,
  'profile RLS stays closed to other members'
);
select throws_ok($$select * from public.list_birthdays('ano')$$, '22023', null, 'the RPC rejects unknown periods');

reset role;
set local role anon;
select throws_ok($$select * from public.list_birthdays('today')$$, '42501', null, 'anonymous users cannot call the RPC');

select * from finish();
rollback;
