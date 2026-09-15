-- Enforce the member preference at the database boundary for every direct
-- notification insert, including administrative announcements.
alter policy notifications_insert_manager on public.notifications
with check (
  (
    public.current_user_is_manager()
    and exists (
      select 1
      from public.profiles profile
      where profile.id = notifications.user_id
        and profile.notifications_enabled
    )
  )
  or (
    source_cell_id is not null
    and public.current_user_leads_cell(source_cell_id)
    and exists (
      select 1
      from public.community_memberships membership
      join public.profiles profile on profile.id = membership.user_id
      where membership.community_id = source_cell_id
        and membership.user_id = notifications.user_id
        and membership.status = 'approved'
        and profile.notifications_enabled
    )
  )
);
