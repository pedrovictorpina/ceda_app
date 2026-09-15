create type public.cell_invitation_status as enum ('pending', 'accepted', 'declined', 'revoked');
create type public.cell_announcement_status as enum ('draft', 'published', 'archived');
create type public.cell_poll_status as enum ('draft', 'published', 'closed');

alter table public.profiles
  add column email_normalized text generated always as (lower(btrim(email))) stored;

alter table public.profiles
  add constraint profiles_email_normalized_key unique (email_normalized);

create table public.cells (
  community_id uuid primary key references public.communities(id) on delete cascade,
  meeting_weekday smallint check (meeting_weekday between 0 and 6),
  meeting_time time,
  active boolean not null default true,
  updated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cell_addresses (
  cell_id uuid primary key references public.cells(community_id) on delete cascade,
  address_line text not null check (char_length(btrim(address_line)) between 3 and 200),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  region text not null check (char_length(btrim(region)) between 2 and 100),
  postal_code text,
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.cell_leaders (
  cell_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (cell_id, user_id),
  constraint cell_leaders_membership_fkey
    foreign key (cell_id, user_id)
    references public.community_memberships(community_id, user_id)
    on delete restrict,
  constraint cell_leaders_cell_fkey
    foreign key (cell_id)
    references public.cells(community_id)
    on delete cascade
);

create table public.cell_invitations (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(community_id) on delete cascade,
  invitee_email text not null references public.profiles(email_normalized) on update cascade on delete restrict,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  status public.cell_invitation_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cell_invitation_email_normalized check (invitee_email = lower(btrim(invitee_email))),
  constraint cell_invitation_response_time check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create table public.cell_announcements (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(community_id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  body text not null check (char_length(btrim(body)) between 3 and 5000),
  status public.cell_announcement_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cell_announcement_dates check (
    (status = 'draft' and published_at is null and archived_at is null)
    or (status = 'published' and published_at is not null and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create table public.cell_polls (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(community_id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 3 and 500),
  status public.cell_poll_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cell_poll_dates check (
    (status = 'draft' and published_at is null and closed_at is null)
    or (status = 'published' and published_at is not null and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  )
);

create table public.cell_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.cell_polls(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 240),
  position smallint not null check (position >= 0),
  unique (poll_id, id),
  unique (poll_id, position)
);

create table public.cell_poll_votes (
  poll_id uuid not null references public.cell_polls(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  constraint cell_poll_votes_valid_option_fkey
    foreign key (poll_id, option_id)
    references public.cell_poll_options(poll_id, id)
    on delete cascade
);

alter table public.notifications
  add column source_cell_id uuid references public.cells(community_id) on delete set null;

create index cells_updated_by_idx on public.cells (updated_by);
create index cell_addresses_updated_by_idx on public.cell_addresses (updated_by);
create index cell_leaders_user_idx on public.cell_leaders (user_id, cell_id);
create index cell_leaders_assigned_by_idx on public.cell_leaders (assigned_by);
create unique index cell_invitations_pending_unique_idx
  on public.cell_invitations (cell_id, invitee_email)
  where status = 'pending';
create index cell_invitations_invitee_idx on public.cell_invitations (invitee_email, status);
create index cell_invitations_invited_by_idx on public.cell_invitations (invited_by);
create index cell_announcements_cell_status_idx on public.cell_announcements (cell_id, status, created_at desc);
create index cell_announcements_created_by_idx on public.cell_announcements (created_by);
create index cell_polls_cell_status_idx on public.cell_polls (cell_id, status, created_at desc);
create index cell_polls_created_by_idx on public.cell_polls (created_by);
create index cell_poll_options_poll_idx on public.cell_poll_options (poll_id, position);
create index cell_poll_votes_user_idx on public.cell_poll_votes (user_id, created_at desc);
create index cell_poll_votes_option_idx on public.cell_poll_votes (option_id);
create index notifications_source_cell_idx on public.notifications (source_cell_id) where source_cell_id is not null;

create function public.current_user_leads_cell(target_cell_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.cell_leaders leader
    where leader.cell_id = target_cell_id
      and leader.user_id = (select auth.uid())
  )
$$;

create function public.current_user_is_cell_member(target_cell_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_memberships membership
    where membership.community_id = target_cell_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'approved'
  )
$$;

revoke all on function public.current_user_leads_cell(uuid) from public;
revoke all on function public.current_user_is_cell_member(uuid) from public;
grant execute on function public.current_user_leads_cell(uuid) to authenticated;
grant execute on function public.current_user_is_cell_member(uuid) to authenticated;

create function public.touch_cell_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger cells_touch_updated_at
before update on public.cells
for each row execute function public.touch_cell_record();

create trigger cell_addresses_touch_updated_at
before update on public.cell_addresses
for each row execute function public.touch_cell_record();

create trigger cell_invitations_touch_updated_at
before update on public.cell_invitations
for each row execute function public.touch_cell_record();

create trigger cell_announcements_touch_updated_at
before update on public.cell_announcements
for each row execute function public.touch_cell_record();

create trigger cell_polls_touch_updated_at
before update on public.cell_polls
for each row execute function public.touch_cell_record();

create function public.guard_cell_community_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.cells cell where cell.community_id = old.id)
    and not public.current_user_is_manager() then
    if not public.current_user_leads_cell(old.id) then
      raise exception 'Only assigned leaders can update this cell.';
    end if;
    if new.id <> old.id or new.created_by <> old.created_by or new.visibility <> 'private' then
      raise exception 'Cell ownership and visibility are immutable for leaders.';
    end if;
  end if;
  return new;
end
$$;

create trigger cell_community_change_guard
before update on public.communities
for each row execute function public.guard_cell_community_change();

create function public.guard_cell_leadership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not public.current_user_is_manager() then
      raise exception 'Only administrators or pastors can assign cell leaders.';
    end if;
    if new.assigned_by <> (select auth.uid()) then
      raise exception 'The assigning manager must match the authenticated user.';
    end if;
    if not exists (
      select 1 from public.community_memberships membership
      where membership.community_id = new.cell_id
        and membership.user_id = new.user_id
        and membership.status = 'approved'
        and membership.role = 'member'
    ) then
      raise exception 'A cell leader must be an approved cell member.';
    end if;
    return new;
  end if;

  if not public.current_user_is_manager() then
    raise exception 'Only administrators or pastors can remove cell leaders.';
  end if;
  if not exists (
    select 1 from public.cell_leaders other_leader
    where other_leader.cell_id = old.cell_id
      and other_leader.user_id <> old.user_id
  ) then
    raise exception 'A cell must keep at least one leader.';
  end if;
  return old;
end
$$;

create trigger cell_leadership_guard
before insert or delete on public.cell_leaders
for each row execute function public.guard_cell_leadership();

create function public.guard_cell_invitation_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_email text := lower(coalesce((select auth.jwt()) ->> 'email', ''));
begin
  if tg_op = 'INSERT' then
    new.invitee_email := lower(btrim(new.invitee_email));
    new.invited_by := (select auth.uid());
    new.status := 'pending';
    new.responded_at := null;
    return new;
  end if;

  if new.cell_id <> old.cell_id
    or new.invitee_email <> old.invitee_email
    or new.invited_by <> old.invited_by
    or new.created_at <> old.created_at then
    raise exception 'Invitation identity fields are immutable.';
  end if;

  if public.current_user_is_manager() then
    if old.status = 'pending' and new.status in ('accepted', 'declined', 'revoked') then
      new.responded_at := coalesce(new.responded_at, now());
      return new;
    end if;
  elsif caller_email = old.invitee_email
    and old.status = 'pending'
    and new.status in ('accepted', 'declined') then
    new.responded_at := now();
    return new;
  elsif public.current_user_leads_cell(old.cell_id)
    and old.status = 'pending'
    and new.status = 'revoked' then
    new.responded_at := now();
    return new;
  end if;

  raise exception 'Invalid invitation status transition.';
end
$$;

create trigger cell_invitation_change_guard
before insert or update on public.cell_invitations
for each row execute function public.guard_cell_invitation_change();

create function public.accept_cell_invitation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.community_memberships (
      community_id, user_id, status, role, invited_by, reviewed_by, reviewed_at
    )
    select new.cell_id, profile.id, 'approved', 'member', new.invited_by, new.invited_by, now()
    from public.profiles profile
    where profile.id = (select auth.uid())
      and profile.email_normalized = new.invitee_email
    on conflict (community_id, user_id) do nothing;
  end if;
  return new;
end
$$;

create trigger cell_invitation_accept_membership
after update of status on public.cell_invitations
for each row execute function public.accept_cell_invitation();

create function public.guard_cell_announcement_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    if new.status = 'published' then
      new.published_at := now();
    else
      new.status := 'draft';
      new.published_at := null;
    end if;
    new.archived_at := null;
    return new;
  end if;

  if new.cell_id <> old.cell_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Announcement identity fields are immutable.';
  end if;
  if old.status = 'archived' and new.status <> 'archived' then
    raise exception 'Archived announcements cannot be reopened.';
  end if;
  if old.status = 'draft' and new.status = 'published' then
    new.published_at := now();
  end if;
  if new.status = 'archived' and old.status <> 'archived' then
    new.archived_at := now();
  end if;
  return new;
end
$$;

create trigger cell_announcement_change_guard
before insert or update on public.cell_announcements
for each row execute function public.guard_cell_announcement_change();

create function public.notify_cell_announcement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    insert into public.notifications (user_id, title, body, deep_link, source_cell_id)
    select distinct membership.user_id,
      new.title,
      left(new.body, 500),
      '/celulas/' || new.cell_id::text || '?comunicado=' || new.id::text,
      new.cell_id
    from public.community_memberships membership
    where membership.community_id = new.cell_id
      and membership.status = 'approved';
  end if;
  return new;
end
$$;

create trigger cell_announcement_publish_notifications
after insert or update of status on public.cell_announcements
for each row execute function public.notify_cell_announcement();

create function public.guard_cell_poll_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.status := 'draft';
    new.published_at := null;
    new.closed_at := null;
    return new;
  end if;

  if new.cell_id <> old.cell_id or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'Poll identity fields are immutable.';
  end if;
  if old.status = 'closed' and new.status <> 'closed' then
    raise exception 'Closed polls cannot be reopened.';
  end if;
  if old.status = 'draft' and new.status = 'published' then
    if (select count(*) from public.cell_poll_options option where option.poll_id = old.id) < 2 then
      raise exception 'A poll needs at least two options before publication.';
    end if;
    new.published_at := now();
  elsif old.status = 'draft' and new.status = 'closed' then
    raise exception 'A draft poll cannot be closed before publication.';
  end if;
  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at := now();
  end if;
  return new;
end
$$;

create trigger cell_poll_change_guard
before insert or update on public.cell_polls
for each row execute function public.guard_cell_poll_change();

create function public.create_cell(
  cell_name text,
  cell_description text,
  weekday smallint,
  meeting_at time,
  leader_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_cell_id uuid;
  unique_leader_count integer;
begin
  if caller_id is null or not public.current_user_is_manager() then
    raise exception 'Only administrators or pastors can create cells.';
  end if;
  if char_length(btrim(cell_name)) < 3 then
    raise exception 'Cell name must contain at least three characters.';
  end if;
  if coalesce(cardinality(leader_ids), 0) < 1 then
    raise exception 'A cell must start with at least one leader.';
  end if;

  select count(distinct leader_id)
  into unique_leader_count
  from unnest(leader_ids) as leaders(leader_id)
  join public.profiles profile on profile.id = leaders.leader_id;

  if unique_leader_count <> (select count(distinct leaders.leader_id) from unnest(leader_ids) as leaders(leader_id)) then
    raise exception 'Every leader must be a registered user.';
  end if;

  insert into public.communities (name, description, visibility, created_by)
  values (btrim(cell_name), nullif(btrim(cell_description), ''), 'private', caller_id)
  returning id into new_cell_id;

  insert into public.cells (community_id, meeting_weekday, meeting_time, updated_by)
  values (new_cell_id, weekday, meeting_at, caller_id);

  insert into public.community_memberships (
    community_id, user_id, status, role, invited_by, reviewed_by, reviewed_at
  )
  select new_cell_id, leader_id, 'approved', 'member', caller_id, caller_id, now()
  from (select distinct unnest(leader_ids) as leader_id) leaders;

  insert into public.cell_leaders (cell_id, user_id, assigned_by)
  select new_cell_id, leader_id, caller_id
  from (select distinct unnest(leader_ids) as leader_id) leaders;

  return new_cell_id;
end
$$;

revoke all on function public.create_cell(text, text, smallint, time, uuid[]) from public;
grant execute on function public.create_cell(text, text, smallint, time, uuid[]) to authenticated;

alter table public.cells enable row level security;
alter table public.cell_addresses enable row level security;
alter table public.cell_leaders enable row level security;
alter table public.cell_invitations enable row level security;
alter table public.cell_announcements enable row level security;
alter table public.cell_polls enable row level security;
alter table public.cell_poll_options enable row level security;
alter table public.cell_poll_votes enable row level security;

revoke all on table public.cells, public.cell_addresses, public.cell_leaders,
  public.cell_invitations, public.cell_announcements, public.cell_polls,
  public.cell_poll_options, public.cell_poll_votes from anon, authenticated;

grant select, insert, update, delete on public.cells, public.cell_addresses to authenticated;
grant select, insert, delete on public.cell_leaders to authenticated;
grant select, insert, update on public.cell_invitations, public.cell_announcements, public.cell_polls to authenticated;
grant select, insert, update, delete on public.cell_poll_options to authenticated;
grant select, insert on public.cell_poll_votes to authenticated;

create policy cells_select on public.cells
for select to authenticated
using (
  public.current_user_is_manager()
  or public.current_user_leads_cell(community_id)
  or public.current_user_is_cell_member(community_id)
  or exists (
    select 1 from public.cell_invitations invitation
    where invitation.cell_id = community_id
      and invitation.invitee_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      and invitation.status = 'pending'
  )
);

create policy cells_insert on public.cells
for insert to authenticated
with check (public.current_user_is_manager() and updated_by = (select auth.uid()));

create policy cells_update on public.cells
for update to authenticated
using (public.current_user_is_manager() or public.current_user_leads_cell(community_id))
with check ((public.current_user_is_manager() or public.current_user_leads_cell(community_id)) and updated_by = (select auth.uid()));

create policy cells_delete on public.cells
for delete to authenticated
using (public.current_user_is_manager());

create policy cell_addresses_select on public.cell_addresses
for select to authenticated
using (public.current_user_is_manager() or public.current_user_leads_cell(cell_id) or public.current_user_is_cell_member(cell_id));

create policy cell_addresses_insert on public.cell_addresses
for insert to authenticated
with check ((public.current_user_is_manager() or public.current_user_leads_cell(cell_id)) and updated_by = (select auth.uid()));

create policy cell_addresses_update on public.cell_addresses
for update to authenticated
using (public.current_user_is_manager() or public.current_user_leads_cell(cell_id))
with check ((public.current_user_is_manager() or public.current_user_leads_cell(cell_id)) and updated_by = (select auth.uid()));

create policy cell_addresses_delete on public.cell_addresses
for delete to authenticated
using (public.current_user_is_manager() or public.current_user_leads_cell(cell_id));

create policy cell_leaders_select on public.cell_leaders
for select to authenticated
using (user_id = (select auth.uid()) or public.current_user_is_manager());

create policy cell_leaders_insert on public.cell_leaders
for insert to authenticated
with check (public.current_user_is_manager() and assigned_by = (select auth.uid()));

create policy cell_leaders_delete on public.cell_leaders
for delete to authenticated
using (public.current_user_is_manager());

create policy cell_invitations_select on public.cell_invitations
for select to authenticated
using (
  public.current_user_is_manager()
  or public.current_user_leads_cell(cell_id)
  or invitee_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
);

create policy cell_invitations_insert on public.cell_invitations
for insert to authenticated
with check (
  (public.current_user_is_manager() or public.current_user_leads_cell(cell_id))
  and invited_by = (select auth.uid())
  and status = 'pending'
);

create policy cell_invitations_update on public.cell_invitations
for update to authenticated
using (
  public.current_user_is_manager()
  or public.current_user_leads_cell(cell_id)
  or (invitee_email = lower(coalesce((select auth.jwt()) ->> 'email', '')) and status = 'pending')
)
with check (
  public.current_user_is_manager()
  or public.current_user_leads_cell(cell_id)
  or invitee_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
);

create policy cell_announcements_select on public.cell_announcements
for select to authenticated
using (
  public.current_user_is_manager()
  or public.current_user_leads_cell(cell_id)
  or (status = 'published' and public.current_user_is_cell_member(cell_id))
);

create policy cell_announcements_insert on public.cell_announcements
for insert to authenticated
with check ((public.current_user_is_manager() or public.current_user_leads_cell(cell_id)) and created_by = (select auth.uid()));

create policy cell_announcements_update on public.cell_announcements
for update to authenticated
using (public.current_user_is_manager() or public.current_user_leads_cell(cell_id))
with check (public.current_user_is_manager() or public.current_user_leads_cell(cell_id));

create policy cell_polls_select on public.cell_polls
for select to authenticated
using (
  public.current_user_is_manager()
  or public.current_user_leads_cell(cell_id)
  or (status in ('published', 'closed') and public.current_user_is_cell_member(cell_id))
);

create policy cell_polls_insert on public.cell_polls
for insert to authenticated
with check ((public.current_user_is_manager() or public.current_user_leads_cell(cell_id)) and created_by = (select auth.uid()));

create policy cell_polls_update on public.cell_polls
for update to authenticated
using (public.current_user_is_manager() or public.current_user_leads_cell(cell_id))
with check (public.current_user_is_manager() or public.current_user_leads_cell(cell_id));

create policy cell_poll_options_select on public.cell_poll_options
for select to authenticated
using (exists (
  select 1 from public.cell_polls poll
  where poll.id = poll_id
    and (
      public.current_user_is_manager()
      or public.current_user_leads_cell(poll.cell_id)
      or (poll.status in ('published', 'closed') and public.current_user_is_cell_member(poll.cell_id))
    )
));

create policy cell_poll_options_insert on public.cell_poll_options
for insert to authenticated
with check (exists (
  select 1 from public.cell_polls poll
  where poll.id = poll_id
    and poll.status = 'draft'
    and (public.current_user_is_manager() or public.current_user_leads_cell(poll.cell_id))
));

create policy cell_poll_options_update on public.cell_poll_options
for update to authenticated
using (exists (
  select 1 from public.cell_polls poll
  where poll.id = poll_id
    and poll.status = 'draft'
    and (public.current_user_is_manager() or public.current_user_leads_cell(poll.cell_id))
))
with check (exists (
  select 1 from public.cell_polls poll
  where poll.id = poll_id
    and poll.status = 'draft'
    and (public.current_user_is_manager() or public.current_user_leads_cell(poll.cell_id))
));

create policy cell_poll_options_delete on public.cell_poll_options
for delete to authenticated
using (exists (
  select 1 from public.cell_polls poll
  where poll.id = poll_id
    and poll.status = 'draft'
    and (public.current_user_is_manager() or public.current_user_leads_cell(poll.cell_id))
));

create policy cell_poll_votes_select on public.cell_poll_votes
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.cell_polls poll
    where poll.id = poll_id
      and (public.current_user_is_manager() or public.current_user_leads_cell(poll.cell_id))
  )
);

create policy cell_poll_votes_insert on public.cell_poll_votes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.cell_polls poll
    where poll.id = poll_id
      and poll.status = 'published'
      and public.current_user_is_cell_member(poll.cell_id)
  )
);

alter policy communities_select on public.communities
using (
  visibility = 'members'
  or created_by = (select auth.uid())
  or public.current_user_is_manager()
  or exists (
    select 1 from public.community_memberships membership
    where membership.community_id = id
      and membership.user_id = (select auth.uid())
      and membership.status = 'approved'
  )
  or exists (
    select 1 from public.cell_invitations invitation
    where invitation.cell_id = id
      and invitation.invitee_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
      and invitation.status = 'pending'
  )
);

alter policy communities_update on public.communities
using (created_by = (select auth.uid()) or public.current_user_is_manager() or public.current_user_leads_cell(id))
with check (created_by = (select auth.uid()) or public.current_user_is_manager() or public.current_user_leads_cell(id));

alter policy community_memberships_select on public.community_memberships
using (
  user_id = (select auth.uid())
  or public.current_user_is_manager()
  or public.current_user_leads_cell(community_id)
);

drop policy community_memberships_request on public.community_memberships;
create policy community_memberships_insert on public.community_memberships
for insert to authenticated
with check (
  public.current_user_is_manager()
  or (
    user_id = (select auth.uid())
    and status = 'pending'
    and role = 'member'
    and invited_by is null
    and reviewed_by is null
  )
  or (
    public.current_user_leads_cell(community_id)
    and role = 'member'
    and status = 'approved'
    and invited_by = (select auth.uid())
  )
  or (
    user_id = (select auth.uid())
    and role = 'member'
    and status = 'approved'
    and exists (
      select 1 from public.cell_invitations invitation
      where invitation.cell_id = community_id
        and invitation.invitee_email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
        and invitation.status = 'accepted'
    )
  )
);

alter policy community_memberships_delete on public.community_memberships
using (
  user_id = (select auth.uid())
  or public.current_user_is_manager()
  or public.current_user_leads_cell(community_id)
);

alter policy profiles_select on public.profiles
using (
  id = (select auth.uid())
  or public.current_user_is_manager()
  or exists (
    select 1 from public.public_directory_entries directory
    where directory.profile_id = id and directory.published
  )
  or exists (
    select 1
    from public.community_memberships membership
    where membership.user_id = id
      and membership.status = 'approved'
      and public.current_user_leads_cell(membership.community_id)
  )
);

alter policy notifications_insert_manager on public.notifications
with check (
  public.current_user_is_manager()
  or (
    source_cell_id is not null
    and public.current_user_leads_cell(source_cell_id)
    and exists (
      select 1 from public.community_memberships membership
      where membership.community_id = source_cell_id
        and membership.user_id = notifications.user_id
        and membership.status = 'approved'
    )
  )
);

revoke all on function public.touch_cell_record() from public, anon, authenticated;
revoke all on function public.guard_cell_community_change() from public, anon, authenticated;
revoke all on function public.guard_cell_leadership() from public, anon, authenticated;
revoke all on function public.guard_cell_invitation_change() from public, anon, authenticated;
revoke all on function public.accept_cell_invitation() from public, anon, authenticated;
revoke all on function public.guard_cell_announcement_change() from public, anon, authenticated;
revoke all on function public.notify_cell_announcement() from public, anon, authenticated;
revoke all on function public.guard_cell_poll_change() from public, anon, authenticated;

comment on table public.cells is 'Private small-group module layered on communities; no public address data.';
comment on table public.cell_addresses is 'Private cell addresses visible only to approved members, assigned leaders, and church managers.';
comment on table public.cell_invitations is 'Invitations for already registered profiles; no email is sent by this module.';
comment on column public.notifications.source_cell_id is 'Internal app notification source; push delivery is handled by a separate future provider.';
