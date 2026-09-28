-- Células: diretório para membros, perfil público dos líderes, endereço com
-- bairro e pedidos de visita ("Quero visitar essa célula").
--
-- Leituras abertas a todos os membros autenticados acontecem somente pelas RPCs
-- da migração seguinte (SECURITY DEFINER, colunas públicas). As políticas RLS
-- existentes de cells, cell_addresses e cell_leaders não são afrouxadas.
--
-- Também corrige a auditoria administrativa: o gatilho de community_memberships
-- recusava toda inserção feita por quem não é administrador/pastor, o que
-- quebrava o aceite de convites de célula e qualquer adição feita por líderes.

-- 1. Endereço: bairro e preferência de exibição -------------------------------

alter table public.cell_addresses
  add column neighborhood text
    check (neighborhood is null or char_length(btrim(neighborhood)) between 2 and 100);

-- NOT VALID: novas escritas usam o formato 00000-000 sem reprovar dados antigos.
alter table public.cell_addresses
  add constraint cell_addresses_postal_code_format
  check (postal_code is null or postal_code ~ '^[0-9]{5}-[0-9]{3}$')
  not valid;

comment on column public.cell_addresses.neighborhood is
  'Bairro do encontro. Sempre exibido no diretório de células junto com cidade e estado.';

alter table public.cells
  add column show_full_address_to_members boolean not null default true;

comment on column public.cells.show_full_address_to_members is
  'Controlado pela liderança. Quando falso, o diretório mostra apenas bairro, cidade e estado; membros, líderes e administração continuam vendo o endereço completo.';

-- 2. Perfil público de cada líder na célula -----------------------------------

alter table public.cell_leaders
  add column bio text check (bio is null or char_length(bio) between 1 and 280),
  add column whatsapp text check (whatsapp is null or whatsapp ~ '^55[0-9]{10,11}$'),
  add column instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column profile_updated_at timestamptz;

comment on column public.cell_leaders.bio is 'Resumo curto (até 280 caracteres) exibido no diretório de células.';
comment on column public.cell_leaders.whatsapp is 'WhatsApp do líder em E.164 somente dígitos (ex.: 5511999990000). Público para membros autenticados.';
comment on column public.cell_leaders.instagram is 'Usuário do Instagram sem @. Público para membros autenticados.';

-- 3. Pedidos de visita ----------------------------------------------------------

create type public.cell_visit_request_status as enum ('pending', 'contacted', 'closed');

create table public.cell_visit_requests (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(community_id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  message text check (message is null or char_length(message) between 1 and 500),
  preferred_date date,
  share_phone boolean not null default false,
  status public.cell_visit_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  constraint cell_visit_requests_handled_consistency check (
    (status = 'pending' and handled_at is null and handled_by is null)
    or (status <> 'pending' and handled_at is not null)
  )
);

comment on table public.cell_visit_requests is
  'Pedidos "Quero visitar essa célula". Criados e atualizados somente pelas RPCs request_cell_visit e update_cell_visit_request; leitura direta limitada ao solicitante, à liderança da célula e à administração.';
comment on column public.cell_visit_requests.share_phone is
  'Consentimento do solicitante para a liderança ver o telefone do perfil e chamar no WhatsApp.';

-- Um pedido em aberto (pendente ou já contatado) por pessoa e célula.
create unique index cell_visit_requests_open_unique_idx
  on public.cell_visit_requests (cell_id, requester_id)
  where status in ('pending', 'contacted');
create index cell_visit_requests_cell_status_idx
  on public.cell_visit_requests (cell_id, status, created_at desc);
create index cell_visit_requests_requester_idx
  on public.cell_visit_requests (requester_id, created_at desc);
create index cell_visit_requests_handled_by_idx
  on public.cell_visit_requests (handled_by) where handled_by is not null;

alter table public.cell_visit_requests enable row level security;

revoke all on table public.cell_visit_requests from anon, authenticated;
grant select on table public.cell_visit_requests to authenticated;

create policy cell_visit_requests_select on public.cell_visit_requests
for select to authenticated
using (
  requester_id = (select auth.uid())
  or public.current_user_is_manager()
  or public.current_user_leads_cell(cell_id)
);

-- 4. Auditoria de membros de célula -------------------------------------------

alter table public.administrative_audit_log
  drop constraint administrative_audit_log_action_check;
alter table public.administrative_audit_log
  add constraint administrative_audit_log_action_check check (action in (
    'content_created',
    'content_updated',
    'content_deleted',
    'membership_approved',
    'membership_rejected',
    'membership_updated',
    'cell_member_added',
    'cell_member_removed'
  ));

comment on table public.administrative_audit_log is
  'Append-only audit trail for manager actions on editorial content, community membership decisions and cell membership changes made by cell leaders.';

create or replace function private.log_administrative_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_is_manager boolean := public.current_user_is_manager();
  audit_action text;
  audit_entity_type text;
  audit_entity_id uuid;
  audit_subject_user_id uuid;
  audit_details jsonb;
begin
  -- Member-created pending requests are not administrative changes. Nested
  -- IFs: PL/pgSQL does not short-circuit, and daily_messages.status is a
  -- different enum that cannot be compared with 'pending'.
  if TG_TABLE_NAME = 'community_memberships' and TG_OP = 'INSERT' then
    if NEW.status = 'pending' then
      return NEW;
    end if;
  end if;

  if actor is null then
    raise exception 'Administrative audit requires an authenticated manager.';
  end if;

  if TG_TABLE_NAME = 'daily_messages' then
    if not actor_is_manager then
      raise exception 'Administrative audit requires an authenticated manager.';
    end if;
    audit_entity_type := 'daily_message';
    audit_entity_id := coalesce(NEW.id, OLD.id);
    audit_subject_user_id := coalesce(NEW.author_id, OLD.author_id);
    audit_action := case TG_OP
      when 'INSERT' then 'content_created'
      when 'UPDATE' then 'content_updated'
      when 'DELETE' then 'content_deleted'
    end;
    audit_details := jsonb_strip_nulls(jsonb_build_object(
      'content_type', coalesce(NEW.content_type, OLD.content_type)::text,
      'title', coalesce(NEW.title, OLD.title),
      'slug', coalesce(NEW.slug, OLD.slug),
      'previous_status', case when TG_OP in ('UPDATE', 'DELETE') then OLD.status::text end,
      'status', case when TG_OP <> 'DELETE' then NEW.status::text end,
      'previous_publish_at', case when TG_OP in ('UPDATE', 'DELETE') then OLD.publish_at end,
      'publish_at', case when TG_OP <> 'DELETE' then NEW.publish_at end
    ));
  elsif TG_TABLE_NAME = 'community_memberships' then
    audit_entity_type := 'community_membership';
    audit_entity_id := NEW.community_id;
    audit_subject_user_id := NEW.user_id;

    if actor_is_manager then
      audit_action := case
        when TG_OP = 'UPDATE' and NEW.status = 'approved' and OLD.status is distinct from NEW.status then 'membership_approved'
        when TG_OP = 'UPDATE' and NEW.status = 'rejected' and OLD.status is distinct from NEW.status then 'membership_rejected'
        else 'membership_updated'
      end;
    else
      -- Non-manager writes reach this point only through the cell rules already
      -- enforced by RLS/RPCs: a leader adding a member to their own cell, or an
      -- invitee accepting their own invitation.
      if not exists (select 1 from public.cells cell where cell.community_id = NEW.community_id)
        or not (
          NEW.user_id = actor
          or exists (
            select 1 from public.cell_leaders leader
            where leader.cell_id = NEW.community_id and leader.user_id = actor
          )
        ) then
        raise exception 'Administrative audit requires an authenticated manager.';
      end if;
      audit_action := 'cell_member_added';
    end if;

    audit_details := jsonb_strip_nulls(jsonb_build_object(
      'community_id', NEW.community_id,
      'previous_status', case when TG_OP = 'UPDATE' then OLD.status::text end,
      'status', NEW.status::text,
      'previous_role', case when TG_OP = 'UPDATE' then OLD.role::text end,
      'role', NEW.role::text
    ));
  else
    raise exception 'Unsupported administrative audit source: %', TG_TABLE_NAME;
  end if;

  insert into public.administrative_audit_log (
    actor_id, action, entity_type, entity_id, subject_user_id, details
  ) values (
    actor, audit_action, audit_entity_type, audit_entity_id, audit_subject_user_id, audit_details
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

revoke all on function private.log_administrative_change() from public, anon, authenticated;

-- Remoções de membros de células (por líderes, administração ou saída própria).
-- Cascatas sem sessão (exclusão de conta, exclusão da célula) não geram evento.
create function private.log_cell_membership_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null
    or not exists (select 1 from public.cells cell where cell.community_id = OLD.community_id)
    or not exists (select 1 from public.profiles profile where profile.id = actor)
    or not exists (select 1 from public.profiles profile where profile.id = OLD.user_id) then
    return OLD;
  end if;

  insert into public.administrative_audit_log (
    actor_id, action, entity_type, entity_id, subject_user_id, details
  ) values (
    actor,
    'cell_member_removed',
    'community_membership',
    OLD.community_id,
    OLD.user_id,
    jsonb_build_object('community_id', OLD.community_id, 'previous_status', OLD.status::text, 'self', OLD.user_id = actor)
  );
  return OLD;
end;
$$;

revoke all on function private.log_cell_membership_removal() from public, anon, authenticated;

create trigger community_memberships_cell_removal_audit
after delete on public.community_memberships
for each row execute function private.log_cell_membership_removal();

-- 5. Utilitários privados -------------------------------------------------------

-- Minúsculas sem acentos, para busca por nome/bairro em português.
create function private.fold_text(value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select translate(
    lower(coalesce(value, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  )
$$;

-- Telefone livre do perfil convertido para E.164 (somente dígitos) quando for
-- um número brasileiro reconhecível; caso contrário, nulo.
create function private.brazilian_phone_digits(value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when digits ~ '^55[0-9]{10,11}$' then digits
    when digits ~ '^[0-9]{10,11}$' then '55' || digits
    else null
  end
  from (select regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g') as digits) normalized
$$;

-- Liderança de uma célula para um usuário explícito (uso dentro de funções
-- SECURITY DEFINER, sem depender do RLS de cell_leaders).
create function private.user_leads_cell(p_cell_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.cell_leaders leader
    where leader.cell_id = p_cell_id and leader.user_id = p_user_id
  )
$$;

revoke all on function private.fold_text(text),
  private.brazilian_phone_digits(text),
  private.user_leads_cell(uuid, uuid) from public, anon, authenticated;
