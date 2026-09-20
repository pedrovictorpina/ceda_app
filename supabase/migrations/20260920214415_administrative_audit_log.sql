-- Immutable operational trail for actions that are already protected by the
-- existing manager RLS policies. The table deliberately has no client update
-- or delete capability: a correction must be represented by a new event.
create table public.administrative_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in (
    'content_created',
    'content_updated',
    'content_deleted',
    'membership_approved',
    'membership_rejected',
    'membership_updated'
  )),
  entity_type text not null check (entity_type in ('daily_message', 'community_membership')),
  entity_id uuid,
  subject_user_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index administrative_audit_log_created_idx
  on public.administrative_audit_log (created_at desc);
create index administrative_audit_log_actor_idx
  on public.administrative_audit_log (actor_id, created_at desc);
create index administrative_audit_log_entity_idx
  on public.administrative_audit_log (entity_type, entity_id, created_at desc);

alter table public.administrative_audit_log enable row level security;

revoke all on table public.administrative_audit_log from anon, authenticated;
grant select on table public.administrative_audit_log to authenticated;

create policy administrative_audit_select_manager
  on public.administrative_audit_log
  for select
  to authenticated
  using (public.current_user_is_manager());

-- Keep the writer private and non-callable. A client must not be able to add a
-- forged audit entry, including an administrator. The function's only caller
-- is the database trigger below; the source tables retain their own RLS rules.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.log_administrative_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  audit_entity_type text;
  audit_entity_id uuid;
  audit_subject_user_id uuid;
  audit_details jsonb;
begin
  -- This function is only meaningful from a trigger. It is a private definer
  -- solely so the append-only table never needs a client INSERT grant.
  if auth.uid() is null or not public.current_user_is_manager() then
    raise exception 'Administrative audit requires an authenticated manager.';
  end if;

  if TG_TABLE_NAME = 'daily_messages' then
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
    -- Member-created pending requests are not administrative changes and are
    -- intentionally excluded. Existing RLS allows review only to managers.
    if TG_OP = 'INSERT' and NEW.status = 'pending' then
      return NEW;
    end if;

    audit_entity_type := 'community_membership';
    audit_entity_id := coalesce(NEW.community_id, OLD.community_id);
    audit_subject_user_id := coalesce(NEW.user_id, OLD.user_id);
    audit_action := case
      when TG_OP = 'UPDATE' and NEW.status = 'approved' and OLD.status is distinct from NEW.status then 'membership_approved'
      when TG_OP = 'UPDATE' and NEW.status = 'rejected' and OLD.status is distinct from NEW.status then 'membership_rejected'
      else 'membership_updated'
    end;
    audit_details := jsonb_strip_nulls(jsonb_build_object(
      'community_id', coalesce(NEW.community_id, OLD.community_id),
      'previous_status', case when TG_OP in ('UPDATE', 'DELETE') then OLD.status::text end,
      'status', case when TG_OP <> 'DELETE' then NEW.status::text end,
      'previous_role', case when TG_OP in ('UPDATE', 'DELETE') then OLD.role::text end,
      'role', case when TG_OP <> 'DELETE' then NEW.role::text end
    ));
  else
    raise exception 'Unsupported administrative audit source: %', TG_TABLE_NAME;
  end if;

  insert into public.administrative_audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    subject_user_id,
    details
  ) values (
    auth.uid(),
    audit_action,
    audit_entity_type,
    audit_entity_id,
    audit_subject_user_id,
    audit_details
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;

create trigger daily_messages_administrative_audit
after insert or update or delete on public.daily_messages
for each row execute function private.log_administrative_change();

create trigger community_memberships_administrative_audit
after insert or update on public.community_memberships
for each row execute function private.log_administrative_change();

revoke all on function private.log_administrative_change() from public, anon, authenticated;

comment on table public.administrative_audit_log is
  'Append-only audit trail for manager actions on editorial content and community membership decisions.';
