-- Personal bookmarks: each member can read and change only their own list.
create table public.saved_messages (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.daily_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
alter table public.saved_messages enable row level security;
revoke all on public.saved_messages from anon, authenticated;
grant select, insert, delete on public.saved_messages to authenticated;
grant all on public.saved_messages to service_role;
create index saved_messages_user_date_idx on public.saved_messages(user_id, created_at desc);
create policy saved_messages_read on public.saved_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy saved_messages_create on public.saved_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.daily_messages message where message.id = message_id
      and message.content_type = 'word_of_day' and message.status = 'published'
      and coalesce(message.publish_at, now()) <= now()
  ));
create policy saved_messages_remove on public.saved_messages for delete to authenticated
  using (user_id = (select auth.uid()));

-- Interactions must reference a post that the caller can actually read.
alter policy comments_insert on public.post_comments
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.posts post where post.id = post_id
  ));
alter policy comments_update on public.post_comments
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.posts post where post.id = post_id
  ));
alter policy likes_select on public.post_likes
  using (exists (select 1 from public.posts post where post.id = post_id));
alter policy likes_insert on public.post_likes
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.posts post where post.id = post_id
  ));
alter policy posts_insert on public.posts
  with check (author_id = (select auth.uid()) and (community_id is null or exists (
    select 1 from public.communities community where community.id = community_id
  )));
alter policy posts_update on public.posts
  using (author_id = (select auth.uid()) or public.current_user_is_manager())
  with check ((author_id = (select auth.uid()) or public.current_user_is_manager())
    and (community_id is null or exists (
      select 1 from public.communities community where community.id = community_id
    )));
alter table public.posts add constraint posts_title_length
  check (char_length(btrim(title)) between 1 and 160) not valid;
alter table public.posts add constraint posts_description_length
  check (char_length(btrim(description)) between 1 and 5000) not valid;
alter table public.post_comments add constraint comments_content_length
  check (char_length(btrim(content)) between 1 and 2000) not valid;

-- A visitor sees only deliberately public services and public event columns.
grant select (id, title, kind, starts_at, ends_at, location, description, cancelled_at, public_visibility, community_id, ministry_id)
  on public.events to anon;
alter policy events_public_service_select on public.events
  using (public_visibility and kind = 'service' and community_id is null
    and ministry_id is null and cancelled_at is null);
