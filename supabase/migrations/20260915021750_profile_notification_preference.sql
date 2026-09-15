alter table public.profiles
  add column notifications_enabled boolean not null default true;

comment on column public.profiles.notifications_enabled is 'Member preference for receiving future in-app notifications. Existing notifications remain available in the inbox.';

create or replace function public.notify_cell_announcement()
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
    join public.profiles profile on profile.id = membership.user_id
    where membership.community_id = new.cell_id
      and membership.status = 'approved'
      and profile.notifications_enabled;
  end if;
  return new;
end
$$;
