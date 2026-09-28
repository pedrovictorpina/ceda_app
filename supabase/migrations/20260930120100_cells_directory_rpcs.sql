-- Células: RPCs do diretório, edição pela liderança, perfil dos líderes,
-- adição/remoção direta de membros e pedidos de visita.
-- Mensagens de erro em pt-BR com errcode 42501 (acesso), 22023 (validação) ou
-- P0001 (regra de negócio), exibidas diretamente pela interface.

-- 1. Edição dos dados da célula (administração e liderança da célula) ---------
-- SECURITY INVOKER: as políticas RLS existentes de communities, cells e
-- cell_addresses continuam sendo a barreira final; a função só valida,
-- normaliza e grava tudo em uma única transação.
create function public.update_cell_details(
  p_cell_id uuid,
  p_name text,
  p_description text,
  p_weekday smallint,
  p_time time,
  p_active boolean,
  p_show_full_address boolean,
  p_address_line text,
  p_neighborhood text,
  p_city text,
  p_region text,
  p_postal_code text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  clean_name text := btrim(coalesce(p_name, ''));
  clean_description text := nullif(btrim(coalesce(p_description, '')), '');
  clean_line text := nullif(btrim(coalesce(p_address_line, '')), '');
  clean_neighborhood text := nullif(btrim(coalesce(p_neighborhood, '')), '');
  clean_city text := nullif(btrim(coalesce(p_city, '')), '');
  clean_region text := nullif(btrim(coalesce(p_region, '')), '');
  postal_digits text := regexp_replace(coalesce(p_postal_code, ''), '[^0-9]', '', 'g');
  has_address boolean;
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cells cell where cell.community_id = p_cell_id) then
    raise exception 'Célula não encontrada.' using errcode = 'P0001';
  end if;
  if not public.current_user_is_manager() and not public.current_user_leads_cell(p_cell_id) then
    raise exception 'Somente a liderança desta célula ou a administração podem editar os dados.' using errcode = '42501';
  end if;
  if char_length(clean_name) not between 3 and 80 then
    raise exception 'Informe o nome da célula com 3 a 80 caracteres.' using errcode = '22023';
  end if;
  if clean_description is not null and char_length(clean_description) > 500 then
    raise exception 'Use até 500 caracteres na descrição.' using errcode = '22023';
  end if;
  if p_weekday is not null and p_weekday not between 0 and 6 then
    raise exception 'Escolha um dia da semana válido.' using errcode = '22023';
  end if;

  has_address := coalesce(clean_line, clean_neighborhood, clean_city, clean_region, nullif(postal_digits, '')) is not null;
  if has_address then
    if clean_line is null or char_length(clean_line) not between 3 and 200 then
      raise exception 'Informe rua e número com 3 a 200 caracteres.' using errcode = '22023';
    end if;
    if clean_neighborhood is null or char_length(clean_neighborhood) not between 2 and 100 then
      raise exception 'Informe o bairro com 2 a 100 caracteres.' using errcode = '22023';
    end if;
    if clean_city is null or char_length(clean_city) not between 2 and 100 then
      raise exception 'Informe a cidade com 2 a 100 caracteres.' using errcode = '22023';
    end if;
    if clean_region is null or char_length(clean_region) not between 2 and 100 then
      raise exception 'Informe o estado.' using errcode = '22023';
    end if;
    if postal_digits <> '' and char_length(postal_digits) <> 8 then
      raise exception 'O CEP deve ter 8 dígitos.' using errcode = '22023';
    end if;
  end if;

  update public.communities
  set name = clean_name, description = clean_description
  where id = p_cell_id;

  update public.cells
  set meeting_weekday = p_weekday,
    meeting_time = p_time,
    active = coalesce(p_active, active),
    show_full_address_to_members = coalesce(p_show_full_address, show_full_address_to_members),
    updated_by = actor
  where community_id = p_cell_id;

  if has_address then
    insert into public.cell_addresses (cell_id, address_line, neighborhood, city, region, postal_code, updated_by)
    values (
      p_cell_id, clean_line, clean_neighborhood, clean_city, clean_region,
      case when postal_digits = '' then null else substr(postal_digits, 1, 5) || '-' || substr(postal_digits, 6, 3) end,
      actor
    )
    on conflict (cell_id) do update
    set address_line = excluded.address_line,
      neighborhood = excluded.neighborhood,
      city = excluded.city,
      region = excluded.region,
      postal_code = excluded.postal_code,
      updated_by = excluded.updated_by;
  else
    delete from public.cell_addresses where cell_id = p_cell_id;
  end if;
end;
$$;

comment on function public.update_cell_details(uuid, text, text, smallint, time, boolean, boolean, text, text, text, text, text) is
  'Atomic edit of cell name, description, schedule, address and address visibility by managers or the cell''s own leaders. Runs under the caller''s RLS.';

revoke all on function public.update_cell_details(uuid, text, text, smallint, time, boolean, boolean, text, text, text, text, text) from public, anon;
grant execute on function public.update_cell_details(uuid, text, text, smallint, time, boolean, boolean, text, text, text, text, text) to authenticated;

-- Criação com endereço em uma única transação (somente administração).
create function public.create_cell_with_details(
  p_name text,
  p_description text,
  p_weekday smallint,
  p_time time,
  p_leader_ids uuid[],
  p_show_full_address boolean,
  p_address_line text,
  p_neighborhood text,
  p_city text,
  p_region text,
  p_postal_code text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_cell_id uuid;
begin
  if (select auth.uid()) is null or not public.current_user_is_manager() then
    raise exception 'Somente administradores e pastores criam células.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 80 then
    raise exception 'Informe o nome da célula com 3 a 80 caracteres.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_leader_ids), 0) < 1 then
    raise exception 'Informe pelo menos um líder cadastrado.' using errcode = '22023';
  end if;
  new_cell_id := public.create_cell(p_name, p_description, p_weekday, p_time, p_leader_ids);
  perform public.update_cell_details(
    new_cell_id, p_name, p_description, p_weekday, p_time, true, p_show_full_address,
    p_address_line, p_neighborhood, p_city, p_region, p_postal_code
  );
  return new_cell_id;
end;
$$;

revoke all on function public.create_cell_with_details(text, text, smallint, time, uuid[], boolean, text, text, text, text, text) from public, anon;
grant execute on function public.create_cell_with_details(text, text, smallint, time, uuid[], boolean, text, text, text, text, text) to authenticated;

-- 2. Diretório de células -------------------------------------------------------
-- Única porta de leitura para quem não participa da célula. Retorna somente
-- campos públicos: nome, descrição, dia/horário, bairro/cidade/estado, endereço
-- completo apenas quando permitido e, dos líderes, nome, foto, resumo e contatos.
create function public.list_cell_directory(p_cell_id uuid default null)
returns table (
  cell_id uuid,
  name text,
  description text,
  meeting_weekday smallint,
  meeting_time time,
  neighborhood text,
  city text,
  region text,
  address_line text,
  postal_code text,
  full_address_visible boolean,
  show_full_address boolean,
  relationship text,
  leaders jsonb,
  my_visit_request jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_is_manager boolean := public.current_user_is_manager();
begin
  if actor is null then
    raise exception 'Entre na sua conta para ver as células.' using errcode = '42501';
  end if;

  return query
  with visible as (
    select cell.community_id,
      community.name,
      community.description,
      cell.meeting_weekday,
      cell.meeting_time,
      cell.show_full_address_to_members,
      case
        when private.user_leads_cell(cell.community_id, actor) then 'leader'
        when exists (
          select 1 from public.community_memberships membership
          where membership.community_id = cell.community_id
            and membership.user_id = actor
            and membership.status = 'approved'
        ) then 'member'
        when actor_is_manager then 'manager'
        else null
      end as relationship
    from public.cells cell
    join public.communities community on community.id = cell.community_id
    where cell.active
      and (p_cell_id is null or cell.community_id = p_cell_id)
  )
  select visible.community_id,
    visible.name,
    visible.description,
    visible.meeting_weekday,
    visible.meeting_time,
    address.neighborhood,
    address.city,
    address.region,
    case when visible.show_full_address_to_members or visible.relationship is not null then address.address_line end,
    case when visible.show_full_address_to_members or visible.relationship is not null then address.postal_code end,
    address.cell_id is not null and (visible.show_full_address_to_members or visible.relationship is not null),
    visible.show_full_address_to_members,
    visible.relationship,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', leader.user_id,
        'full_name', profile.full_name,
        'avatar_path', profile.avatar_path,
        'bio', leader.bio,
        'whatsapp', leader.whatsapp,
        'instagram', leader.instagram
      ) order by leader.assigned_at, profile.full_name)
      from public.cell_leaders leader
      join public.profiles profile on profile.id = leader.user_id
      where leader.cell_id = visible.community_id
    ), '[]'::jsonb),
    (
      select jsonb_build_object('id', request.id, 'status', request.status, 'created_at', request.created_at, 'preferred_date', request.preferred_date)
      from public.cell_visit_requests request
      where request.cell_id = visible.community_id
        and request.requester_id = actor
      order by (request.status <> 'closed') desc, request.created_at desc
      limit 1
    )
  from visible
  left join public.cell_addresses address on address.cell_id = visible.community_id
  order by visible.name;
end;
$$;

comment on function public.list_cell_directory(uuid) is
  'Active cells for any authenticated member with public fields only. Full address only when the leadership allows it or the caller belongs to/leads/manages the cell.';

revoke all on function public.list_cell_directory(uuid) from public, anon;
grant execute on function public.list_cell_directory(uuid) to authenticated;

-- 3. Perfil público do líder ------------------------------------------------------
create function public.update_cell_leader_profile(
  p_cell_id uuid,
  p_user_id uuid,
  p_bio text,
  p_whatsapp text,
  p_instagram text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  clean_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  whatsapp_digits text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  clean_instagram text := nullif(ltrim(btrim(coalesce(p_instagram, '')), '@'), '');
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if not private.user_leads_cell(p_cell_id, p_user_id) then
    raise exception 'Esta pessoa não é líder desta célula.' using errcode = 'P0001';
  end if;
  if p_user_id <> actor and not public.current_user_is_manager() then
    raise exception 'Cada líder edita o próprio perfil; a administração pode editar qualquer líder.' using errcode = '42501';
  end if;
  if clean_bio is not null and char_length(clean_bio) > 280 then
    raise exception 'Use até 280 caracteres no resumo.' using errcode = '22023';
  end if;
  if whatsapp_digits ~ '^[0-9]{10,11}$' then
    whatsapp_digits := '55' || whatsapp_digits;
  end if;
  if whatsapp_digits <> '' and whatsapp_digits !~ '^55[0-9]{10,11}$' then
    raise exception 'Informe o WhatsApp com DDD, por exemplo (11) 99999-0000.' using errcode = '22023';
  end if;
  if clean_instagram is not null and clean_instagram !~ '^[A-Za-z0-9._]{1,30}$' then
    raise exception 'Informe o usuário do Instagram com letras, números, ponto ou sublinhado (até 30).' using errcode = '22023';
  end if;

  update public.cell_leaders
  set bio = clean_bio,
    whatsapp = nullif(whatsapp_digits, ''),
    instagram = clean_instagram,
    profile_updated_at = now()
  where cell_id = p_cell_id and user_id = p_user_id;
end;
$$;

revoke all on function public.update_cell_leader_profile(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.update_cell_leader_profile(uuid, uuid, text, text, text) to authenticated;

-- 4. Membros: busca, adição direta e remoção pela liderança ---------------------
create function public.search_members_for_cell(p_cell_id uuid, p_query text)
returns table (id uuid, full_name text, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  needle text := private.fold_text(btrim(coalesce(p_query, '')));
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if not public.current_user_is_manager() and not private.user_leads_cell(p_cell_id, actor) then
    raise exception 'Somente a liderança desta célula ou a administração podem buscar membros.' using errcode = '42501';
  end if;
  if char_length(needle) < 2 or char_length(needle) > 60 then
    raise exception 'Digite de 2 a 60 caracteres para buscar.' using errcode = '22023';
  end if;
  needle := replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  select profile.id, profile.full_name, profile.avatar_path
  from public.profiles profile
  where private.fold_text(profile.full_name) like '%' || needle || '%'
    and not exists (
      select 1 from public.community_memberships membership
      where membership.community_id = p_cell_id
        and membership.user_id = profile.id
        and membership.status = 'approved'
    )
  order by profile.full_name
  limit 20;
end;
$$;

comment on function public.search_members_for_cell(uuid, text) is
  'Name search (min. 2 characters, 20 results) for leaders/managers adding people to a cell. Returns only id, name and avatar path of people not yet in the cell.';

revoke all on function public.search_members_for_cell(uuid, text) from public, anon;
grant execute on function public.search_members_for_cell(uuid, text) to authenticated;

create function public.add_cell_member(p_cell_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.cells cell where cell.community_id = p_cell_id) then
    raise exception 'Célula não encontrada.' using errcode = 'P0001';
  end if;
  if not public.current_user_is_manager() and not private.user_leads_cell(p_cell_id, actor) then
    raise exception 'Somente a liderança desta célula ou a administração podem adicionar membros.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles profile where profile.id = p_user_id) then
    raise exception 'Pessoa não encontrada no app.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.community_memberships membership
    where membership.community_id = p_cell_id and membership.user_id = p_user_id and membership.status = 'approved'
  ) then
    raise exception 'Essa pessoa já participa da célula.' using errcode = 'P0001';
  end if;

  insert into public.community_memberships (
    community_id, user_id, status, role, invited_by, reviewed_by, reviewed_at
  ) values (p_cell_id, p_user_id, 'approved', 'member', actor, actor, now())
  on conflict (community_id, user_id) do update
  set status = 'approved', role = 'member', reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at;

  update public.cell_visit_requests
  set status = 'closed', handled_by = actor, handled_at = now()
  where cell_id = p_cell_id and requester_id = p_user_id and status in ('pending', 'contacted');
end;
$$;

revoke all on function public.add_cell_member(uuid, uuid) from public, anon;
grant execute on function public.add_cell_member(uuid, uuid) to authenticated;

create function public.remove_cell_member(p_cell_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if not public.current_user_is_manager() and not private.user_leads_cell(p_cell_id, actor) then
    raise exception 'Somente a liderança desta célula ou a administração podem remover membros.' using errcode = '42501';
  end if;
  if private.user_leads_cell(p_cell_id, p_user_id) then
    raise exception 'Líderes só podem ser removidos pela administração. Retire a liderança antes de remover da célula.' using errcode = 'P0001';
  end if;

  delete from public.community_memberships
  where community_id = p_cell_id and user_id = p_user_id;
  if not found then
    raise exception 'Essa pessoa não participa desta célula.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.remove_cell_member(uuid, uuid) from public, anon;
grant execute on function public.remove_cell_member(uuid, uuid) to authenticated;

-- 5. Pedidos de visita --------------------------------------------------------------
create function public.request_cell_visit(
  p_cell_id uuid,
  p_message text default null,
  p_preferred_date date default null,
  p_share_phone boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  local_today date := (now() at time zone 'America/Sao_Paulo')::date;
  clean_message text := nullif(btrim(coalesce(p_message, '')), '');
  requester_name text;
  target_name text;
  recent_requests integer;
  created_id uuid;
begin
  if actor is null then
    raise exception 'Entre na sua conta para pedir uma visita.' using errcode = '42501';
  end if;

  select community.name into target_name
  from public.cells cell
  join public.communities community on community.id = cell.community_id
  where cell.community_id = p_cell_id and cell.active;
  if target_name is null then
    raise exception 'Esta célula não está disponível para visitas.' using errcode = 'P0001';
  end if;

  if private.user_leads_cell(p_cell_id, actor) or exists (
    select 1 from public.community_memberships membership
    where membership.community_id = p_cell_id and membership.user_id = actor and membership.status = 'approved'
  ) then
    raise exception 'Você já participa desta célula.' using errcode = 'P0001';
  end if;
  if clean_message is not null and char_length(clean_message) > 500 then
    raise exception 'Use até 500 caracteres na mensagem.' using errcode = '22023';
  end if;
  if p_preferred_date is not null and (p_preferred_date < local_today or p_preferred_date > local_today + 180) then
    raise exception 'Escolha uma data a partir de hoje e em até 6 meses.' using errcode = '22023';
  end if;

  -- Serializa pedidos simultâneos da mesma pessoa antes de contar o limite.
  select profile.full_name into requester_name
  from public.profiles profile where profile.id = actor for update;
  if requester_name is null then
    raise exception 'Complete seu perfil antes de pedir uma visita.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.cell_visit_requests request
    where request.cell_id = p_cell_id and request.requester_id = actor and request.status in ('pending', 'contacted')
  ) then
    raise exception 'Você já tem um pedido de visita em aberto para esta célula.' using errcode = 'P0001';
  end if;

  select count(*) into recent_requests
  from public.cell_visit_requests request
  where request.requester_id = actor and request.created_at > now() - interval '1 day';
  if recent_requests >= 5 then
    raise exception 'Limite de 5 pedidos de visita por dia atingido. Tente novamente amanhã.' using errcode = 'P0001';
  end if;

  insert into public.cell_visit_requests (cell_id, requester_id, message, preferred_date, share_phone)
  values (p_cell_id, actor, clean_message, p_preferred_date, coalesce(p_share_phone, false))
  returning id into created_id;

  insert into public.notifications (user_id, title, body, deep_link, source_cell_id)
  select leader.user_id,
    'Pedido de visita',
    left(requester_name || ' quer visitar a ' || target_name || '.'
      || case when clean_message is not null then ' "' || clean_message || '"' else '' end, 500),
    '/celulas/' || p_cell_id::text || '?visita=' || created_id::text,
    p_cell_id
  from public.cell_leaders leader
  join public.profiles profile on profile.id = leader.user_id
  where leader.cell_id = p_cell_id
    and profile.notifications_enabled;

  return created_id;
end;
$$;

comment on function public.request_cell_visit(uuid, text, date, boolean) is
  '"Quero visitar essa célula": one open request per person and cell, 5 requests per day per person, in-app notification to leaders who accept notifications.';

revoke all on function public.request_cell_visit(uuid, text, date, boolean) from public, anon;
grant execute on function public.request_cell_visit(uuid, text, date, boolean) to authenticated;

create function public.list_cell_visit_requests(p_cell_id uuid)
returns table (
  id uuid,
  requester_id uuid,
  requester_name text,
  requester_avatar_path text,
  requester_phone text,
  message text,
  preferred_date date,
  status public.cell_visit_request_status,
  created_at timestamptz,
  handled_at timestamptz,
  handled_by_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if not public.current_user_is_manager() and not private.user_leads_cell(p_cell_id, actor) then
    raise exception 'Somente a liderança desta célula ou a administração veem os pedidos de visita.' using errcode = '42501';
  end if;

  return query
  select request.id,
    request.requester_id,
    requester.full_name,
    requester.avatar_path,
    case when request.share_phone then private.brazilian_phone_digits(requester.phone) end,
    request.message,
    request.preferred_date,
    request.status,
    request.created_at,
    request.handled_at,
    handler.full_name
  from public.cell_visit_requests request
  join public.profiles requester on requester.id = request.requester_id
  left join public.profiles handler on handler.id = request.handled_by
  where request.cell_id = p_cell_id
    and (request.status in ('pending', 'contacted') or request.handled_at > now() - interval '30 days')
  order by (request.status = 'pending') desc, request.created_at desc
  limit 100;
end;
$$;

comment on function public.list_cell_visit_requests(uuid) is
  'Open visit requests (and those closed in the last 30 days) for the cell leadership. The phone is returned only when the requester chose to share it.';

revoke all on function public.list_cell_visit_requests(uuid) from public, anon;
grant execute on function public.list_cell_visit_requests(uuid) to authenticated;

create function public.update_cell_visit_request(p_request_id uuid, p_status public.cell_visit_request_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.cell_visit_requests%rowtype;
  is_staff boolean;
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  select * into target from public.cell_visit_requests where id = p_request_id for update;
  if not found then
    raise exception 'Pedido de visita não encontrado.' using errcode = 'P0001';
  end if;

  is_staff := public.current_user_is_manager() or private.user_leads_cell(target.cell_id, actor);
  if not is_staff and not (target.requester_id = actor and p_status = 'closed') then
    raise exception 'Você não pode alterar este pedido de visita.' using errcode = '42501';
  end if;
  if target.status = 'closed' then
    raise exception 'Este pedido já foi encerrado.' using errcode = 'P0001';
  end if;
  if p_status = 'pending' or p_status = target.status then
    raise exception 'Escolha uma nova situação para o pedido.' using errcode = '22023';
  end if;

  update public.cell_visit_requests
  set status = p_status, handled_by = actor, handled_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.update_cell_visit_request(uuid, public.cell_visit_request_status) from public, anon;
grant execute on function public.update_cell_visit_request(uuid, public.cell_visit_request_status) to authenticated;
