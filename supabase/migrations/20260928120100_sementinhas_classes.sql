-- Sementinhas (formerly "Ovelhinhas"): members register their own children,
-- teachers organise classes and the classroom door runs on check-in/check-out.
-- Table names keep the original "children_*" prefix on purpose.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Children: ownership, photo and validation -------------------------------

alter table public.children
  add column photo_path text,
  add column created_by uuid references public.profiles(id) on delete set null;

-- NOT VALID keeps legacy rows untouched while every new write is checked.
alter table public.children
  add constraint children_full_name_length
    check (char_length(btrim(full_name)) between 2 and 120) not valid,
  add constraint children_birth_date_not_future
    check (birth_date is null or birth_date <= current_date) not valid,
  add constraint children_allergies_length
    check (allergies is null or char_length(allergies) <= 300) not valid,
  add constraint children_emergency_contact_length
    check (emergency_contact is null or char_length(emergency_contact) <= 120) not valid,
  add constraint children_photo_path_in_child_folder
    check (photo_path is null or photo_path like (id::text || '/%'));

comment on table public.children is 'Sementinhas child profiles. Visible only to linked guardians, children staff and administrators.';
comment on column public.children.birth_date is 'Source for derived age; never persist age.';
comment on column public.children.photo_path is 'Object path in the private child-photos bucket, always under "<child id>/".';
comment on column public.children.created_by is 'Member who registered the child and became its first guardian.';

create index children_created_by_idx on public.children (created_by, created_at desc);
create index children_full_name_idx on public.children (lower(full_name));

-- Classes, teachers, enrollments and check-ins ------------------------------

create table public.children_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  min_age smallint not null check (min_age between 0 and 17),
  max_age smallint not null check (max_age between 0 and 17),
  room text check (room is null or char_length(btrim(room)) between 1 and 80),
  notes text check (notes is null or char_length(notes) <= 500),
  archived_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_classes_age_range check (min_age <= max_age)
);

comment on table public.children_classes is 'Sementinhas classes. The age description ("de X a Y anos") is derived from min_age and max_age.';

create unique index children_classes_active_name_idx
  on public.children_classes (lower(btrim(name))) where archived_at is null;
create index children_classes_created_by_idx on public.children_classes (created_by);

create table public.children_class_teachers (
  class_id uuid not null references public.children_classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  added_by uuid not null references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

comment on table public.children_class_teachers is 'Teachers responsible for a class. Only they (and administrators) see its roster and alert guardians.';

create index children_class_teachers_teacher_idx on public.children_class_teachers (teacher_id);
create index children_class_teachers_added_by_idx on public.children_class_teachers (added_by);

create table public.children_class_enrollments (
  class_id uuid not null references public.children_classes(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  added_by uuid not null references public.profiles(id),
  added_at timestamptz not null default now(),
  primary key (class_id, child_id)
);

comment on table public.children_class_enrollments is 'Children that belong to a class. A child outside the age range may still be enrolled.';

create index children_class_enrollments_child_idx on public.children_class_enrollments (child_id);
create index children_class_enrollments_added_by_idx on public.children_class_enrollments (added_by);

create table public.children_checkins (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  class_id uuid not null references public.children_classes(id) on delete restrict,
  status text not null default 'checked_in' check (status in ('checked_in', 'checked_out', 'expired')),
  checked_in_by uuid not null references public.profiles(id),
  checked_in_at timestamptz not null default now(),
  checked_out_by uuid references public.profiles(id),
  checked_out_at timestamptz,
  constraint children_checkins_checkout_consistency check (
    (status = 'checked_out' and checked_out_at is not null and checked_out_by is not null)
    or (status <> 'checked_out' and checked_out_at is null and checked_out_by is null)
  )
);

comment on table public.children_checkins is 'Classroom attendance. Written only through check_in_child/check_out_child; a forgotten check-in expires on the next one.';

-- One open check-in per child, enforced by the database.
create unique index children_checkins_one_open_idx
  on public.children_checkins (child_id) where status = 'checked_in';
create index children_checkins_class_open_idx
  on public.children_checkins (class_id, checked_in_at desc) where status = 'checked_in';
create index children_checkins_child_idx on public.children_checkins (child_id, checked_in_at desc);
create index children_checkins_checked_in_by_idx on public.children_checkins (checked_in_by);
create index children_checkins_checked_out_by_idx on public.children_checkins (checked_out_by) where checked_out_by is not null;

-- Alerts and audit ---------------------------------------------------------

alter table public.children_alerts
  add column checkin_id uuid references public.children_checkins(id) on delete set null,
  add column class_id uuid references public.children_classes(id) on delete set null,
  add column reason text check (
    reason is null or reason in ('needs_you', 'clothing_change', 'crying', 'minor_injury', 'other')
  );

alter table public.children_alerts
  add constraint children_alerts_message_length check (char_length(message) between 1 and 300) not valid;

create index children_alerts_guardian_open_idx
  on public.children_alerts (guardian_id, created_at desc) where acknowledged_at is null;
create index children_alerts_checkin_idx
  on public.children_alerts (checkin_id, created_at desc) where checkin_id is not null;
create index children_alerts_child_idx on public.children_alerts (child_id);
create index children_alerts_sent_by_idx on public.children_alerts (sent_by);

alter table public.children_audit_log drop constraint children_audit_log_action_check;
alter table public.children_audit_log add constraint children_audit_log_action_check check (action in (
  'guardian_granted', 'guardian_removed', 'link_created', 'link_removed', 'alert_sent', 'alert_acknowledged',
  'child_registered', 'child_updated', 'child_removed',
  'class_created', 'class_updated', 'class_archived', 'class_restored',
  'class_enrolled', 'class_unenrolled', 'class_teacher_joined', 'class_teacher_left',
  'checked_in', 'checked_out'
));

-- Removing a child (privacy request) must not be blocked by its audit trail.
alter table public.children_audit_log drop constraint children_audit_log_child_id_fkey;
alter table public.children_audit_log
  add constraint children_audit_log_child_id_fkey
  foreign key (child_id) references public.children(id) on delete set null;
alter table public.children_audit_log
  add column class_id uuid references public.children_classes(id) on delete set null;

create index children_audit_log_created_idx on public.children_audit_log (created_at desc);
create index children_audit_log_child_idx on public.children_audit_log (child_id) where child_id is not null;
create index children_audit_log_actor_idx on public.children_audit_log (actor_id, created_at desc);

-- Authorization helpers (SECURITY INVOKER, evaluated with the caller's JWT) ----

create function public.current_user_is_children_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  -- Teachers are the children team. Legacy children_team_members rows still count.
  select public.current_user_has_role('administrator')
    or public.current_user_has_role('teacher')
    or exists (
      select 1
      from public.children_team_members team
      where team.user_id = (select auth.uid())
    )
$$;

create function public.current_user_guards_child(target_child_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_guardians guardian
    where guardian.child_id = target_child_id
      and guardian.guardian_id = (select auth.uid())
  )
$$;

create function public.current_user_guards_child_object(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.child_guardians guardian
    where guardian.guardian_id = (select auth.uid())
      and guardian.child_id::text = (storage.foldername(object_name))[1]
  )
$$;

create function public.current_user_teaches_class(target_class_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.current_user_has_role('administrator')
    or exists (
      select 1
      from public.children_class_teachers teacher
      where teacher.class_id = target_class_id
        and teacher.teacher_id = (select auth.uid())
    )
$$;

-- SECURITY DEFINER on purpose: the classes policy needs to look at enrollments,
-- whose insert policy looks at classes. Reading through RLS would make Postgres
-- report infinite policy recursion. It only answers a yes/no about the caller.
create function public.current_user_guards_child_in_class(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.children_class_enrollments enrollment
    join public.child_guardians guardian on guardian.child_id = enrollment.child_id
    where enrollment.class_id = target_class_id
      and guardian.guardian_id = (select auth.uid())
  )
$$;

revoke all on function public.current_user_guards_child_in_class(uuid) from public, anon;
grant execute on function public.current_user_guards_child_in_class(uuid) to authenticated;
revoke all on function public.current_user_is_children_staff() from public, anon;
revoke all on function public.current_user_guards_child(uuid) from public, anon;
revoke all on function public.current_user_guards_child_object(text) from public, anon;
revoke all on function public.current_user_teaches_class(uuid) from public, anon;
grant execute on function public.current_user_is_children_staff() to authenticated;
grant execute on function public.current_user_guards_child(uuid) to authenticated;
grant execute on function public.current_user_guards_child_object(text) to authenticated;
grant execute on function public.current_user_teaches_class(uuid) to authenticated;

-- Private writers and triggers ---------------------------------------------

create function private.log_children_event(
  p_action text,
  p_child_id uuid,
  p_class_id uuid,
  p_subject_user_id uuid,
  p_details jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service-role maintenance has no actor; the trail records member actions.
  if auth.uid() is null then
    return;
  end if;
  insert into public.children_audit_log (actor_id, action, child_id, class_id, subject_user_id, details)
  values (auth.uid(), p_action, p_child_id, p_class_id, p_subject_user_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

create function private.guard_child_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  new.full_name := btrim(new.full_name);
  new.allergies := nullif(btrim(coalesce(new.allergies, '')), '');
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.created_by is distinct from old.created_by then
      raise exception 'Estes dados da criança não podem ser alterados.' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  if (tg_op = 'INSERT' or new.birth_date is distinct from old.birth_date) and new.birth_date is not null then
    if new.birth_date > today then
      raise exception 'A data de nascimento não pode estar no futuro.' using errcode = '22023';
    end if;
    if new.birth_date <= (today - interval '18 years')::date then
      raise exception 'O Sementinhas atende crianças de até 17 anos.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger children_guard_row
before insert or update on public.children
for each row execute function private.guard_child_row();

create function private.log_child_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if new.full_name is distinct from old.full_name then changed := array_append(changed, 'full_name'); end if;
  if new.birth_date is distinct from old.birth_date then changed := array_append(changed, 'birth_date'); end if;
  if new.photo_path is distinct from old.photo_path then changed := array_append(changed, 'photo'); end if;
  if new.allergies is distinct from old.allergies then changed := array_append(changed, 'allergies'); end if;
  if new.emergency_contact is distinct from old.emergency_contact then changed := array_append(changed, 'emergency_contact'); end if;
  if cardinality(changed) > 0 then
    perform private.log_children_event('child_updated', new.id, null, null, jsonb_build_object('fields', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger children_log_update
after update on public.children
for each row execute function private.log_child_update();

create function private.prepare_children_class()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.room := nullif(btrim(coalesce(new.room, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.created_by <> old.created_by then
      raise exception 'Estes dados da turma não podem ser alterados.' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger children_classes_prepare
before insert or update on public.children_classes
for each row execute function private.prepare_children_class();

create function private.after_children_class_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- The creator teaches the class from the start.
    insert into public.children_class_teachers (class_id, teacher_id, added_by)
    values (new.id, new.created_by, new.created_by)
    on conflict do nothing;
    perform private.log_children_event('class_created', null, new.id, null,
      jsonb_build_object('name', new.name, 'min_age', new.min_age, 'max_age', new.max_age));
  elsif old.archived_at is null and new.archived_at is not null then
    perform private.log_children_event('class_archived', null, new.id, null, jsonb_build_object('name', new.name));
  elsif old.archived_at is not null and new.archived_at is null then
    perform private.log_children_event('class_restored', null, new.id, null, jsonb_build_object('name', new.name));
  elsif (new.name, new.min_age, new.max_age, new.room, new.notes)
    is distinct from (old.name, old.min_age, old.max_age, old.room, old.notes) then
    perform private.log_children_event('class_updated', null, new.id, null,
      jsonb_build_object('name', new.name, 'min_age', new.min_age, 'max_age', new.max_age));
  end if;
  return new;
end;
$$;

create trigger children_classes_after_change
after insert or update on public.children_classes
for each row execute function private.after_children_class_change();

create function private.log_class_enrollment_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_children_event('class_enrolled', new.child_id, new.class_id, null, '{}'::jsonb);
    return new;
  end if;
  -- Cascades from a removed child or class must not reference missing rows.
  if exists (select 1 from public.children where id = old.child_id)
    and exists (select 1 from public.children_classes where id = old.class_id) then
    perform private.log_children_event('class_unenrolled', old.child_id, old.class_id, null, '{}'::jsonb);
  end if;
  return old;
end;
$$;

create trigger children_class_enrollments_audit
after insert or delete on public.children_class_enrollments
for each row execute function private.log_class_enrollment_change();

create function private.log_class_teacher_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_children_event('class_teacher_joined', null, new.class_id, new.teacher_id, '{}'::jsonb);
    return new;
  end if;
  if exists (select 1 from public.children_classes where id = old.class_id)
    and exists (select 1 from public.profiles where id = old.teacher_id) then
    perform private.log_children_event('class_teacher_left', null, old.class_id, old.teacher_id, '{}'::jsonb);
  end if;
  return old;
end;
$$;

create trigger children_class_teachers_audit
after insert or delete on public.children_class_teachers
for each row execute function private.log_class_teacher_change();

create function private.expire_stale_child_checkins(target_child_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- A check-in left open on a previous day was forgotten; it no longer counts.
  update public.children_checkins
  set status = 'expired'
  where child_id = target_child_id
    and status = 'checked_in'
    and (checked_in_at at time zone 'America/Sao_Paulo')::date < (now() at time zone 'America/Sao_Paulo')::date;
end;
$$;

revoke all on function private.log_children_event(text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.guard_child_row() from public, anon, authenticated;
revoke all on function private.log_child_update() from public, anon, authenticated;
revoke all on function private.prepare_children_class() from public, anon, authenticated;
revoke all on function private.after_children_class_change() from public, anon, authenticated;
revoke all on function private.log_class_enrollment_change() from public, anon, authenticated;
revoke all on function private.log_class_teacher_change() from public, anon, authenticated;
revoke all on function private.expire_stale_child_checkins(uuid) from public, anon, authenticated;

-- Row level security -------------------------------------------------------

alter table public.children_classes enable row level security;
alter table public.children_class_teachers enable row level security;
alter table public.children_class_enrollments enable row level security;
alter table public.children_checkins enable row level security;

revoke all on table public.children_classes, public.children_class_teachers,
  public.children_class_enrollments, public.children_checkins from anon, authenticated;
grant select, insert, update on table public.children_classes to authenticated;
grant select, insert, delete on table public.children_class_teachers to authenticated;
grant select, insert, delete on table public.children_class_enrollments to authenticated;
grant select on table public.children_checkins to authenticated;

-- Alerts are written only by send_child_alert/acknowledge_child_alert.
revoke insert, update, delete on table public.children_alerts from authenticated;
drop policy children_alerts_insert on public.children_alerts;
drop policy children_alerts_update on public.children_alerts;
drop policy children_alerts_select on public.children_alerts;
create policy children_alerts_select on public.children_alerts
for select to authenticated using (
  guardian_id = (select auth.uid())
  or sent_by = (select auth.uid())
  or (select public.current_user_has_role('administrator'))
  or (class_id is not null and public.current_user_teaches_class(class_id))
);

-- Guardians no longer need a separate approval to see their own children.
drop policy children_select on public.children;
create policy children_select on public.children
for select to authenticated using (
  (select public.current_user_is_children_staff())
  or public.current_user_guards_child(id)
);

drop policy children_update on public.children;
create policy children_update on public.children
for update to authenticated
using ((select public.current_user_has_role('administrator')) or public.current_user_guards_child(id))
with check ((select public.current_user_has_role('administrator')) or public.current_user_guards_child(id));

drop policy child_guardians_select on public.child_guardians;
create policy child_guardians_select on public.child_guardians
for select to authenticated using (
  guardian_id = (select auth.uid())
  or (select public.current_user_is_children_staff())
);

create policy children_classes_select on public.children_classes
for select to authenticated using (
  (select public.current_user_is_children_staff())
  or public.current_user_guards_child_in_class(id)
);

create policy children_classes_insert on public.children_classes
for insert to authenticated with check (
  (select public.current_user_is_children_staff())
  and created_by = (select auth.uid())
  and archived_at is null
);

create policy children_classes_update on public.children_classes
for update to authenticated
using ((select public.current_user_is_children_staff()))
with check ((select public.current_user_is_children_staff()));

create policy children_class_teachers_select on public.children_class_teachers
for select to authenticated using ((select public.current_user_is_children_staff()));

create policy children_class_teachers_insert on public.children_class_teachers
for insert to authenticated with check (
  (select public.current_user_is_children_staff())
  and added_by = (select auth.uid())
  and (teacher_id = (select auth.uid()) or (select public.current_user_has_role('administrator')))
);

create policy children_class_teachers_delete on public.children_class_teachers
for delete to authenticated using (
  teacher_id = (select auth.uid())
  or (select public.current_user_has_role('administrator'))
);

create policy children_class_enrollments_select on public.children_class_enrollments
for select to authenticated using (
  (select public.current_user_is_children_staff())
  or public.current_user_guards_child(child_id)
);

create policy children_class_enrollments_insert on public.children_class_enrollments
for insert to authenticated with check (
  (select public.current_user_is_children_staff())
  and added_by = (select auth.uid())
  and exists (
    select 1
    from public.children_classes target_class
    where target_class.id = class_id
      and target_class.archived_at is null
  )
);

create policy children_class_enrollments_delete on public.children_class_enrollments
for delete to authenticated using ((select public.current_user_is_children_staff()));

create policy children_checkins_select on public.children_checkins
for select to authenticated using (
  public.current_user_guards_child(child_id)
  or public.current_user_teaches_class(class_id)
);

-- Private child photos -----------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'child-photos', 'child-photos', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy child_photos_select on storage.objects
for select to authenticated using (
  bucket_id = 'child-photos'
  and ((select public.current_user_is_children_staff()) or public.current_user_guards_child_object(name))
);

create policy child_photos_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'child-photos'
  and owner_id = (select auth.uid())::text
  and ((select public.current_user_has_role('administrator')) or public.current_user_guards_child_object(name))
);

create policy child_photos_update on storage.objects
for update to authenticated
using (
  bucket_id = 'child-photos'
  and ((select public.current_user_has_role('administrator')) or public.current_user_guards_child_object(name))
)
with check (
  bucket_id = 'child-photos'
  and ((select public.current_user_has_role('administrator')) or public.current_user_guards_child_object(name))
);

create policy child_photos_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'child-photos'
  and (
    owner_id = (select auth.uid())::text
    or (select public.current_user_has_role('administrator'))
    or public.current_user_guards_child_object(name)
  )
);
