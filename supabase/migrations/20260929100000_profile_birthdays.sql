-- Aniversariantes: consentimento explícito para aparecer nas listas e imagens
-- de felicitações. A data de nascimento já existe em public.profiles (fundação);
-- aqui só adicionamos a validação de faixa e a preferência de consentimento.
-- A leitura para outros membros acontece exclusivamente pela RPC abaixo, que
-- expõe apenas nome, foto e dia/mês. As políticas RLS de profiles não mudam.

alter table public.profiles
  add column birthday_greetings_opt_in boolean not null default false;

comment on column public.profiles.birthday_greetings_opt_in is
  'Member consent to appear (name, photo, day and month only) in birthday lists and greeting images. Defaults to false.';

-- NOT VALID: novas escritas são validadas sem reprovar a migração por algum
-- registro antigo fora da faixa. A RPC também ignora datas fora da faixa.
alter table public.profiles
  add constraint profiles_birth_date_range
  check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date))
  not valid;

-- Data em que o aniversário é comemorado em um ano. Quem nasceu em 29/02
-- comemora em 28/02 nos anos não bissextos (mantém a data dentro de fevereiro).
create function private.observed_birthday(p_birth_date date, p_year integer)
returns date
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when extract(month from p_birth_date) = 2
      and extract(day from p_birth_date) = 29
      and extract(day from (make_date(p_year, 3, 1) - 1)) = 28
      then make_date(p_year, 2, 28)
    else make_date(p_year, extract(month from p_birth_date)::integer, extract(day from p_birth_date)::integer)
  end
$$;

-- Intervalo de cada período a partir de um "hoje" já convertido para o fuso da
-- igreja. Semana = segunda a domingo da semana atual (date_trunc ISO).
create function private.birthday_period_bounds(p_period text, p_today date)
returns table (range_start date, range_end date)
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_period = 'today' then
    return query select p_today, p_today;
  elsif p_period = 'week' then
    return query select date_trunc('week', p_today)::date, date_trunc('week', p_today)::date + 6;
  elsif p_period = 'month' then
    return query select date_trunc('month', p_today)::date,
      (date_trunc('month', p_today) + interval '1 month')::date - 1;
  else
    raise exception 'Período inválido. Use hoje, semana ou mês.' using errcode = '22023';
  end if;
end;
$$;

-- Membros com consentimento cujo aniversário cai no intervalo. O intervalo pode
-- atravessar a virada do ano (ex.: semana de 28/12 a 03/01), por isso a data
-- comemorada é testada no ano do início e no ano do fim.
create function private.birthdays_between(p_from date, p_to date)
returns table (
  id uuid,
  full_name text,
  avatar_path text,
  birth_day integer,
  birth_month integer,
  celebration_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select profile.id,
    profile.full_name,
    profile.avatar_path,
    extract(day from profile.birth_date)::integer,
    extract(month from profile.birth_date)::integer,
    observed.celebration_date
  from public.profiles profile
  cross join lateral (
    select candidate as celebration_date
    from (values
      (private.observed_birthday(profile.birth_date, extract(year from p_from)::integer)),
      (private.observed_birthday(profile.birth_date, extract(year from p_to)::integer))
    ) as candidates (candidate)
    where candidate between p_from and p_to
    order by candidate
    limit 1
  ) observed
  where profile.birthday_greetings_opt_in
    and profile.birth_date is not null
    and profile.birth_date between date '1900-01-01' and current_date
    and p_from <= p_to
    and p_to - p_from <= 31
  order by observed.celebration_date, profile.full_name
$$;

revoke all on function private.observed_birthday(date, integer),
  private.birthday_period_bounds(text, date),
  private.birthdays_between(date, date) from public, anon, authenticated;

-- Única porta de leitura para membros autenticados. SECURITY DEFINER para não
-- afrouxar o RLS de profiles; nunca retorna ano de nascimento, idade, e-mail ou
-- telefone. "Hoje" é calculado em America/Sao_Paulo.
create function public.list_birthdays(p_period text)
returns table (
  id uuid,
  full_name text,
  avatar_path text,
  birth_day integer,
  birth_month integer,
  celebration_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  local_today date := (now() at time zone 'America/Sao_Paulo')::date;
  bounds record;
begin
  if (select auth.uid()) is null then
    raise exception 'Entre na sua conta para ver os aniversariantes.' using errcode = '42501';
  end if;
  select * into bounds from private.birthday_period_bounds(p_period, local_today);
  return query
    select birthday.id, birthday.full_name, birthday.avatar_path,
      birthday.birth_day, birthday.birth_month, birthday.celebration_date
    from private.birthdays_between(bounds.range_start, bounds.range_end) birthday;
end;
$$;

comment on function public.list_birthdays(text) is
  'Opted-in birthdays for today, the current Monday-Sunday week or the current month (America/Sao_Paulo). Exposes name, avatar path and day/month only.';

revoke all on function public.list_birthdays(text) from public, anon;
grant execute on function public.list_birthdays(text) to authenticated;
