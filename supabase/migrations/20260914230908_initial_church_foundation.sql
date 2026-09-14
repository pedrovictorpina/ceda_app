create extension if not exists pgcrypto;

create type public.system_role as enum ('member', 'administrator', 'pastor');
create type public.membership_role as enum ('member', 'leader');
create type public.membership_status as enum ('pending', 'approved', 'rejected', 'invited');
create type public.community_visibility as enum ('members', 'private');
create type public.event_kind as enum ('service', 'event', 'meeting', 'rehearsal', 'activity');
create type public.reminder_lead as enum ('week', 'day', 'hour');
create type public.publication_status as enum ('draft', 'scheduled', 'published', 'archived');

create function public.current_user_has_role(required_role public.system_role)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' -> 'roles' ? required_role::text), false)
$$;

revoke all on function public.current_user_has_role(public.system_role) from public;
grant execute on function public.current_user_has_role(public.system_role) to authenticated;

create function public.current_user_is_manager()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.current_user_has_role('administrator') or public.current_user_has_role('pastor')
$$;

revoke all on function public.current_user_is_manager() from public;
grant execute on function public.current_user_is_manager() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null,
  phone text,
  avatar_path text,
  sex text check (sex in ('female', 'male', 'not_informed')),
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.birth_date is 'Source for derived age; never persist age.';

create table public.user_system_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.system_role not null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.church_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.user_church_tags (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag_id uuid not null references public.church_tags(id) on delete cascade,
  primary key (user_id, tag_id)
);

create table public.ministries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.ministry_memberships (
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null default 'member',
  function_name text,
  joined_at timestamptz not null default now(),
  primary key (ministry_id, user_id)
);

create table public.daily_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  image_path text,
  author_id uuid not null references public.profiles(id),
  message_date date not null,
  status public.publication_status not null default 'draft',
  publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_requires_date check (status <> 'scheduled' or publish_at is not null)
);

create table public.daily_message_history (
  id bigint generated always as identity primary key,
  message_id uuid not null references public.daily_messages(id) on delete cascade,
  editor_id uuid not null references public.profiles(id),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  visibility public.community_visibility not null default 'members',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.community_memberships (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.membership_status not null default 'pending',
  role public.membership_role not null default 'member',
  invited_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  community_id uuid references public.communities(id) on delete cascade,
  title text not null,
  description text not null,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind public.event_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  description text,
  image_path text,
  responsible_id uuid not null references public.profiles(id),
  community_id uuid references public.communities(id) on delete cascade,
  ministry_id uuid references public.ministries(id) on delete cascade,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint event_dates_valid check (ends_at is null or ends_at >= starts_at)
);

create table public.event_reminders (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lead public.reminder_lead not null,
  scheduled_for timestamptz not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id, lead)
);

create table public.guardian_access (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status public.membership_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  allergies text,
  emergency_contact text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.child_guardians (
  child_id uuid not null references public.children(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (child_id, guardian_id)
);

create table public.children_team_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now()
);

create table public.children_alerts (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id),
  sent_by uuid not null references public.profiles(id),
  message text not null,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.children_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('guardian_granted', 'guardian_removed', 'link_created', 'link_removed', 'alert_sent', 'alert_acknowledged')),
  subject_user_id uuid references public.profiles(id),
  child_id uuid references public.children(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  deep_link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.integration_settings (
  provider text primary key check (provider in ('instagram', 'youtube')),
  enabled boolean not null default false,
  public_config jsonb not null default '{}'::jsonb,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create index daily_messages_publication_idx on public.daily_messages (status, publish_at, message_date desc);
create index community_memberships_user_idx on public.community_memberships (user_id, status);
create index posts_created_idx on public.posts (created_at desc);
create index events_starts_idx on public.events (starts_at);
create index child_guardians_guardian_idx on public.child_guardians (guardian_id);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.user_system_roles enable row level security;
alter table public.church_tags enable row level security;
alter table public.user_church_tags enable row level security;
alter table public.ministries enable row level security;
alter table public.ministry_memberships enable row level security;
alter table public.daily_messages enable row level security;
alter table public.daily_message_history enable row level security;
alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.events enable row level security;
alter table public.event_reminders enable row level security;
alter table public.guardian_access enable row level security;
alter table public.children enable row level security;
alter table public.child_guardians enable row level security;
alter table public.children_team_members enable row level security;
alter table public.children_alerts enable row level security;
alter table public.children_audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.integration_settings enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.user_system_roles, public.church_tags, public.user_church_tags, public.ministries, public.ministry_memberships to authenticated;
grant select, insert, update, delete on public.daily_messages, public.daily_message_history, public.communities, public.community_memberships, public.posts, public.post_comments, public.post_likes, public.events, public.event_reminders, public.guardian_access, public.children, public.child_guardians, public.children_team_members, public.children_alerts, public.children_audit_log, public.notifications, public.integration_settings to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()) or public.current_user_is_manager());
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_select_self_or_manager on public.user_system_roles for select to authenticated using (user_id = (select auth.uid()) or public.current_user_is_manager());
create policy tags_select on public.church_tags for select to authenticated using (true);
create policy user_tags_select on public.user_church_tags for select to authenticated using (user_id = (select auth.uid()) or public.current_user_is_manager());
create policy ministries_select on public.ministries for select to authenticated using (true);
create policy memberships_select on public.ministry_memberships for select to authenticated using (true);

create policy messages_select on public.daily_messages for select to authenticated using ((status = 'published' and coalesce(publish_at, now()) <= now()) or author_id = (select auth.uid()) or public.current_user_is_manager());
create policy messages_insert on public.daily_messages for insert to authenticated with check (author_id = (select auth.uid()) and public.current_user_is_manager());
create policy messages_update on public.daily_messages for update to authenticated using (public.current_user_is_manager()) with check (public.current_user_is_manager());
create policy messages_delete on public.daily_messages for delete to authenticated using (public.current_user_is_manager());
create policy message_history_select on public.daily_message_history for select to authenticated using (public.current_user_is_manager());
create policy message_history_insert on public.daily_message_history for insert to authenticated with check (editor_id = (select auth.uid()) and public.current_user_is_manager());

create policy communities_select on public.communities for select to authenticated using (visibility = 'members' or created_by = (select auth.uid()) or public.current_user_is_manager() or exists (select 1 from public.community_memberships cm where cm.community_id = id and cm.user_id = (select auth.uid()) and cm.status = 'approved'));
create policy communities_insert on public.communities for insert to authenticated with check (created_by = (select auth.uid()));
create policy communities_update on public.communities for update to authenticated using (created_by = (select auth.uid()) or public.current_user_is_manager()) with check (created_by = (select auth.uid()) or public.current_user_is_manager());
create policy communities_delete on public.communities for delete to authenticated using (created_by = (select auth.uid()) or public.current_user_is_manager());
create policy community_memberships_select on public.community_memberships for select to authenticated using (user_id = (select auth.uid()) or public.current_user_is_manager());
create policy community_memberships_request on public.community_memberships for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy community_memberships_review on public.community_memberships for update to authenticated using (public.current_user_is_manager()) with check (public.current_user_is_manager());
create policy community_memberships_delete on public.community_memberships for delete to authenticated using (user_id = (select auth.uid()) or public.current_user_is_manager());

create policy posts_select on public.posts for select to authenticated using (community_id is null or exists (select 1 from public.communities c where c.id = community_id));
create policy posts_insert on public.posts for insert to authenticated with check (author_id = (select auth.uid()));
create policy posts_update on public.posts for update to authenticated using (author_id = (select auth.uid()) or public.current_user_is_manager()) with check (author_id = (select auth.uid()) or public.current_user_is_manager());
create policy posts_delete on public.posts for delete to authenticated using (author_id = (select auth.uid()) or public.current_user_is_manager());
create policy comments_select on public.post_comments for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
create policy comments_insert on public.post_comments for insert to authenticated with check (author_id = (select auth.uid()));
create policy comments_update on public.post_comments for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy comments_delete on public.post_comments for delete to authenticated using (author_id = (select auth.uid()) or public.current_user_is_manager());
create policy likes_select on public.post_likes for select to authenticated using (true);
create policy likes_insert on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy likes_delete on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy events_select on public.events for select to authenticated using (community_id is null or exists (select 1 from public.communities c where c.id = community_id));
create policy events_insert on public.events for insert to authenticated with check (responsible_id = (select auth.uid()) or public.current_user_is_manager());
create policy events_update on public.events for update to authenticated using (responsible_id = (select auth.uid()) or public.current_user_is_manager()) with check (responsible_id = (select auth.uid()) or public.current_user_is_manager());
create policy events_delete on public.events for delete to authenticated using (responsible_id = (select auth.uid()) or public.current_user_is_manager());
create policy reminders_select on public.event_reminders for select to authenticated using (user_id = (select auth.uid()));
create policy reminders_insert on public.event_reminders for insert to authenticated with check (user_id = (select auth.uid()));
create policy reminders_update on public.event_reminders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reminders_delete on public.event_reminders for delete to authenticated using (user_id = (select auth.uid()));

create policy guardian_access_select on public.guardian_access for select to authenticated using (user_id = (select auth.uid()) or public.current_user_has_role('administrator'));
create policy guardian_access_request on public.guardian_access for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy guardian_access_review on public.guardian_access for update to authenticated using (public.current_user_has_role('administrator')) with check (public.current_user_has_role('administrator'));
create policy children_select on public.children for select to authenticated using (public.current_user_has_role('administrator') or exists (select 1 from public.children_team_members t where t.user_id = (select auth.uid())) or exists (select 1 from public.child_guardians cg join public.guardian_access ga on ga.user_id = cg.guardian_id and ga.status = 'approved' where cg.child_id = id and cg.guardian_id = (select auth.uid())));
create policy children_insert on public.children for insert to authenticated with check (public.current_user_has_role('administrator'));
create policy children_update on public.children for update to authenticated using (public.current_user_has_role('administrator')) with check (public.current_user_has_role('administrator'));
create policy children_delete on public.children for delete to authenticated using (public.current_user_has_role('administrator'));
create policy child_guardians_select on public.child_guardians for select to authenticated using (guardian_id = (select auth.uid()) or public.current_user_has_role('administrator') or exists (select 1 from public.children_team_members t where t.user_id = (select auth.uid())));
create policy child_guardians_insert on public.child_guardians for insert to authenticated with check (public.current_user_has_role('administrator'));
create policy child_guardians_update on public.child_guardians for update to authenticated using (public.current_user_has_role('administrator')) with check (public.current_user_has_role('administrator'));
create policy child_guardians_delete on public.child_guardians for delete to authenticated using (public.current_user_has_role('administrator'));
create policy children_team_select on public.children_team_members for select to authenticated using (user_id = (select auth.uid()) or public.current_user_has_role('administrator'));
create policy children_team_insert on public.children_team_members for insert to authenticated with check (public.current_user_has_role('administrator'));
create policy children_team_update on public.children_team_members for update to authenticated using (public.current_user_has_role('administrator')) with check (public.current_user_has_role('administrator'));
create policy children_team_delete on public.children_team_members for delete to authenticated using (public.current_user_has_role('administrator'));
create policy children_alerts_select on public.children_alerts for select to authenticated using (guardian_id = (select auth.uid()) or sent_by = (select auth.uid()) or public.current_user_has_role('administrator'));
create policy children_alerts_insert on public.children_alerts for insert to authenticated with check (sent_by = (select auth.uid()) and (public.current_user_has_role('administrator') or exists (select 1 from public.children_team_members t where t.user_id = (select auth.uid()))));
create policy children_alerts_update on public.children_alerts for update to authenticated using (guardian_id = (select auth.uid())) with check (guardian_id = (select auth.uid()));
create policy audit_select on public.children_audit_log for select to authenticated using (public.current_user_has_role('administrator'));
create policy audit_insert on public.children_audit_log for insert to authenticated with check (actor_id = (select auth.uid()) and (public.current_user_has_role('administrator') or exists (select 1 from public.children_team_members t where t.user_id = (select auth.uid()))));

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_insert_manager on public.notifications for insert to authenticated with check (public.current_user_is_manager());
create policy integrations_select on public.integration_settings for select to authenticated using (true);
create policy integrations_insert on public.integration_settings for insert to authenticated with check (public.current_user_is_manager());
create policy integrations_update on public.integration_settings for update to authenticated using (public.current_user_is_manager()) with check (public.current_user_is_manager());
create policy integrations_delete on public.integration_settings for delete to authenticated using (public.current_user_is_manager());

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', false),
  ('message-media', 'message-media', false),
  ('feed-media', 'feed-media', false),
  ('child-private', 'child-private', false)
on conflict (id) do nothing;

create policy avatar_read on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy avatar_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatar_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and owner_id = (select auth.uid())::text);
create policy shared_media_read on storage.objects for select to authenticated using (bucket_id in ('message-media', 'feed-media'));
create policy shared_media_insert on storage.objects for insert to authenticated with check (bucket_id in ('message-media', 'feed-media') and owner_id = (select auth.uid())::text);
create policy shared_media_update on storage.objects for update to authenticated using (bucket_id in ('message-media', 'feed-media') and (owner_id = (select auth.uid())::text or public.current_user_is_manager())) with check (bucket_id in ('message-media', 'feed-media'));
create policy shared_media_delete on storage.objects for delete to authenticated using (bucket_id in ('message-media', 'feed-media') and (owner_id = (select auth.uid())::text or public.current_user_is_manager()));
create policy child_media_read on storage.objects for select to authenticated using (bucket_id = 'child-private' and public.current_user_has_role('administrator'));
create policy child_media_manage on storage.objects for all to authenticated using (bucket_id = 'child-private' and public.current_user_has_role('administrator')) with check (bucket_id = 'child-private' and public.current_user_has_role('administrator'));

alter publication supabase_realtime add table public.notifications, public.children_alerts, public.daily_messages, public.events;

create type public.content_type as enum ('word_of_day', 'news');
create type public.prayer_visibility as enum ('private', 'pastoral', 'community');
create type public.prayer_status as enum ('active', 'answered', 'archived');
create type public.deletion_request_status as enum ('requested', 'reviewing', 'completed', 'rejected', 'cancelled');

alter table public.daily_messages add column content_type public.content_type not null default 'word_of_day';
alter table public.daily_messages add column slug text unique;

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  details text,
  visibility public.prayer_visibility not null default 'private',
  status public.prayer_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image_url text,
  external_url text,
  goal_amount numeric(12,2) check (goal_amount is null or goal_amount > 0),
  raised_amount numeric(12,2) not null default 0 check (raised_amount >= 0),
  published boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.church_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line text not null,
  city text not null,
  region text not null,
  postal_code text,
  map_url text,
  is_primary boolean not null default false,
  published boolean not null default true
);

alter table public.events add column location_id uuid references public.church_locations(id);
alter table public.events add column recurrence_rule text;
alter table public.events add column public_visibility boolean not null default false;

create table public.official_contacts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  role_label text not null,
  email text,
  phone text,
  published boolean not null default false,
  consent_recorded_at timestamptz,
  profile_id uuid references public.profiles(id) on delete set null,
  sort_order integer not null default 0,
  constraint published_contact_has_consent check (not published or consent_recorded_at is not null)
);

create table public.public_directory_entries (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  title text not null,
  area text,
  published boolean not null default false,
  consent_recorded_at timestamptz,
  sort_order integer not null default 0,
  constraint published_directory_has_consent check (not published or consent_recorded_at is not null)
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.deletion_request_status not null default 'requested',
  confirmed_at timestamptz not null,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

create table public.account_deletion_audit_log (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.account_deletion_requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  from_status public.deletion_request_status,
  to_status public.deletion_request_status not null,
  created_at timestamptz not null default now()
);

alter table public.prayer_requests enable row level security;
alter table public.campaigns enable row level security;
alter table public.church_locations enable row level security;
alter table public.official_contacts enable row level security;
alter table public.public_directory_entries enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_audit_log enable row level security;

revoke all on table public.prayer_requests, public.campaigns, public.church_locations, public.official_contacts, public.public_directory_entries, public.account_deletion_requests, public.account_deletion_audit_log from anon, authenticated;
grant select, insert, update, delete on public.prayer_requests, public.campaigns, public.account_deletion_requests, public.account_deletion_audit_log to authenticated;
grant select on public.church_locations, public.official_contacts, public.public_directory_entries to anon, authenticated;
grant insert, update, delete on public.church_locations, public.official_contacts, public.public_directory_entries to authenticated;
grant select (id, full_name, avatar_path) on public.profiles to anon;
grant usage, select on all sequences in schema public to authenticated;

alter policy profiles_select on public.profiles using (id = (select auth.uid()) or public.current_user_is_manager() or exists (select 1 from public.public_directory_entries d where d.profile_id = id and d.published));
create policy profiles_public_directory on public.profiles for select to anon using (exists (select 1 from public.public_directory_entries d where d.profile_id = id and d.published));
create policy prayer_select on public.prayer_requests for select to authenticated using (author_id = (select auth.uid()) or (visibility = 'pastoral' and public.current_user_is_manager()) or visibility = 'community');
create policy prayer_insert on public.prayer_requests for insert to authenticated with check (author_id = (select auth.uid()));
create policy prayer_update on public.prayer_requests for update to authenticated using (author_id = (select auth.uid()) or public.current_user_is_manager()) with check (author_id = (select auth.uid()) or public.current_user_is_manager());
create policy prayer_delete on public.prayer_requests for delete to authenticated using (author_id = (select auth.uid()));
create policy campaigns_public_select on public.campaigns for select to anon using (published);
create policy campaigns_authenticated_select on public.campaigns for select to authenticated using (published or public.current_user_is_manager());
create policy campaigns_insert on public.campaigns for insert to authenticated with check (public.current_user_is_manager());
create policy campaigns_update on public.campaigns for update to authenticated using (public.current_user_is_manager()) with check (public.current_user_is_manager());
create policy campaigns_delete on public.campaigns for delete to authenticated using (public.current_user_is_manager());
create policy locations_public_select on public.church_locations for select to anon using (published);
create policy locations_authenticated_select on public.church_locations for select to authenticated using (published or public.current_user_is_manager());
create policy locations_insert on public.church_locations for insert to authenticated with check (public.current_user_is_manager());
create policy locations_update on public.church_locations for update to authenticated using (public.current_user_is_manager()) with check (public.current_user_is_manager());
create policy locations_delete on public.church_locations for delete to authenticated using (public.current_user_is_manager());
create policy contacts_public_select on public.official_contacts for select to anon using (published and consent_recorded_at is not null);
create policy contacts_authenticated_select on public.official_contacts for select to authenticated using ((published and consent_recorded_at is not null) or public.current_user_is_manager());
create policy contacts_insert on public.official_contacts for insert to authenticated with check (public.current_user_is_manager());
create policy contacts_update on public.official_contacts for update to authenticated using (public.current_user_is_manager()) with check (public.current_user_is_manager());
create policy contacts_delete on public.official_contacts for delete to authenticated using (public.current_user_is_manager());
create policy directory_public_select on public.public_directory_entries for select to anon using (published and consent_recorded_at is not null);
create policy directory_authenticated_select on public.public_directory_entries for select to authenticated using ((published and consent_recorded_at is not null) or public.current_user_is_manager());
create policy directory_insert on public.public_directory_entries for insert to authenticated with check (public.current_user_is_manager());
create policy directory_update on public.public_directory_entries for update to authenticated using (public.current_user_is_manager()) with check (public.current_user_is_manager());
create policy directory_delete on public.public_directory_entries for delete to authenticated using (public.current_user_is_manager());
create policy deletion_select on public.account_deletion_requests for select to authenticated using (user_id = (select auth.uid()) or public.current_user_has_role('administrator'));
create policy deletion_insert on public.account_deletion_requests for insert to authenticated with check (user_id = (select auth.uid()) and status = 'requested' and confirmed_at is not null);
create policy deletion_update on public.account_deletion_requests for update to authenticated using (public.current_user_has_role('administrator')) with check (public.current_user_has_role('administrator'));
create policy deletion_audit_select on public.account_deletion_audit_log for select to authenticated using (public.current_user_has_role('administrator') or exists (select 1 from public.account_deletion_requests r where r.id = request_id and r.user_id = (select auth.uid())));
create policy deletion_audit_insert on public.account_deletion_audit_log for insert to authenticated with check (actor_id = (select auth.uid()) and public.current_user_has_role('administrator'));

create policy events_public_service_select on public.events for select to anon using (public_visibility and kind = 'service');
