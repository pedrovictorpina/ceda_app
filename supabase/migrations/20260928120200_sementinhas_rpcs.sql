-- Sementinhas write paths that must be atomic or cross RLS boundaries. Every
-- function checks the caller explicitly and records the action in the
-- children audit trail. Messages are user-facing (pt-BR).

create function public.register_child(
  p_full_name text,
  p_birth_date date,
  p_allergies text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_allergies text := nullif(btrim(coalesce(p_allergies, '')), '');
  recent_registrations integer;
  created_id uuid;
begin
  if actor is null then
    raise exception 'Entre na sua conta para cadastrar uma criança.' using errcode = '42501';
  end if;
  if char_length(clean_name) not between 2 and 120 then
    raise exception 'Informe o nome da criança com 2 a 120 caracteres.' using errcode = '22023';
  end if;
  if p_birth_date is null or p_birth_date > today then
    raise exception 'Informe uma data de nascimento válida.' using errcode = '22023';
  end if;
  if p_birth_date <= (today - interval '18 years')::date then
    raise exception 'O Sementinhas atende crianças de até 17 anos.' using errcode = '22023';
  end if;
  if clean_allergies is not null and char_length(clean_allergies) > 300 then
    raise exception 'Descreva alergias e cuidados em até 300 caracteres.' using errcode = '22023';
  end if;

  select count(*) into recent_registrations
  from public.children
  where created_by = actor
    and created_at > now() - interval '1 day';
  if recent_registrations >= 10 then
    raise exception 'Limite diário de cadastros atingido. Tente novamente amanhã.' using errcode = 'P0001';
  end if;

  insert into public.children (full_name, birth_date, allergies, created_by)
  values (clean_name, p_birth_date, clean_allergies, actor)
  returning id into created_id;

  insert into public.child_guardians (child_id, guardian_id, granted_by)
  values (created_id, actor, actor);

  perform private.log_children_event('child_registered', created_id, null, actor, '{}'::jsonb);
  return created_id;
end;
$$;

create function public.remove_child(p_child_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  is_admin boolean := public.current_user_has_role('administrator');
  is_guardian boolean;
  other_guardians integer;
  removed_photo text;
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  is_guardian := public.current_user_guards_child(p_child_id);
  if not is_guardian and not is_admin then
    raise exception 'Você não é responsável por esta criança.' using errcode = '42501';
  end if;

  perform 1 from public.children where id = p_child_id for update;
  if not found then
    raise exception 'Criança não encontrada.' using errcode = 'P0001';
  end if;

  perform private.expire_stale_child_checkins(p_child_id);
  if exists (select 1 from public.children_checkins where child_id = p_child_id and status = 'checked_in') then
    raise exception 'Faça o check-out antes de remover a criança.' using errcode = 'P0001';
  end if;

  select count(*) into other_guardians
  from public.child_guardians
  where child_id = p_child_id and guardian_id <> actor;

  -- Another guardian keeps the profile; only this member's link is removed.
  if is_guardian and other_guardians > 0 then
    delete from public.child_guardians where child_id = p_child_id and guardian_id = actor;
    perform private.log_children_event('guardian_removed', p_child_id, null, actor, jsonb_build_object('self', true));
    return jsonb_build_object('deleted', false, 'photo_path', null);
  end if;

  perform private.log_children_event('child_removed', p_child_id, null, null,
    jsonb_build_object('guardians', other_guardians + case when is_guardian then 1 else 0 end));
  delete from public.children where id = p_child_id returning photo_path into removed_photo;
  return jsonb_build_object('deleted', true, 'photo_path', removed_photo);
end;
$$;

create function public.check_in_child(p_child_id uuid, p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target_class public.children_classes%rowtype;
  created_id uuid;
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if not public.current_user_guards_child(p_child_id) and not public.current_user_has_role('administrator') then
    raise exception 'Somente os responsáveis podem fazer o check-in desta criança.' using errcode = '42501';
  end if;

  select * into target_class from public.children_classes where id = p_class_id;
  if not found or target_class.archived_at is not null then
    raise exception 'Esta turma não está disponível.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.children_class_enrollments
    where class_id = p_class_id and child_id = p_child_id
  ) then
    raise exception 'A criança não faz parte desta turma.' using errcode = 'P0001';
  end if;

  -- Serialize concurrent taps for the same child.
  perform 1 from public.children where id = p_child_id for update;
  perform private.expire_stale_child_checkins(p_child_id);
  if exists (select 1 from public.children_checkins where child_id = p_child_id and status = 'checked_in') then
    raise exception 'Esta criança já está na salinha.' using errcode = 'P0001';
  end if;

  insert into public.children_checkins (child_id, class_id, checked_in_by)
  values (p_child_id, p_class_id, actor)
  returning id into created_id;

  perform private.log_children_event('checked_in', p_child_id, p_class_id, null, jsonb_build_object('checkin_id', created_id));
  return created_id;
exception
  when unique_violation then
    raise exception 'Esta criança já está na salinha.' using errcode = 'P0001';
end;
$$;

create function public.check_out_child(p_checkin_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.children_checkins%rowtype;
  by_guardian boolean;
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;

  select * into target from public.children_checkins where id = p_checkin_id for update;
  if not found then
    raise exception 'Check-in não encontrado.' using errcode = 'P0001';
  end if;

  by_guardian := public.current_user_guards_child(target.child_id);
  if not by_guardian and not public.current_user_teaches_class(target.class_id) then
    raise exception 'Você não pode registrar a saída desta criança.' using errcode = '42501';
  end if;
  if target.status <> 'checked_in' then
    raise exception 'Este check-in já foi encerrado.' using errcode = 'P0001';
  end if;

  update public.children_checkins
  set status = 'checked_out', checked_out_at = now(), checked_out_by = actor
  where id = p_checkin_id;

  -- Pending calls lose their purpose once the child has left the room.
  update public.children_alerts
  set acknowledged_at = now()
  where checkin_id = p_checkin_id and acknowledged_at is null;

  perform private.log_children_event('checked_out', target.child_id, target.class_id, null,
    jsonb_build_object('checkin_id', p_checkin_id, 'by', case when by_guardian then 'guardian' else 'staff' end));
end;
$$;

create function public.send_child_alert(
  p_checkin_id uuid,
  p_reason text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.children_checkins%rowtype;
  clean_note text := nullif(btrim(coalesce(p_note, '')), '');
  reason_label text;
  alert_message text;
  child_first_name text;
  class_name text;
  guardians_alerted integer;
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('needs_you', 'clothing_change', 'crying', 'minor_injury', 'other') then
    raise exception 'Escolha o motivo do alerta.' using errcode = '22023';
  end if;
  if p_reason = 'other' and clean_note is null then
    raise exception 'Descreva o motivo do alerta.' using errcode = '22023';
  end if;
  if clean_note is not null and char_length(clean_note) > 200 then
    raise exception 'A mensagem deve ter até 200 caracteres.' using errcode = '22023';
  end if;

  -- Row lock serializes concurrent sends so the rate limit below holds.
  select * into target from public.children_checkins where id = p_checkin_id for update;
  if not found or target.status <> 'checked_in' then
    raise exception 'A criança não está mais na salinha.' using errcode = 'P0001';
  end if;
  if not public.current_user_teaches_class(target.class_id) then
    raise exception 'Somente professores desta turma podem enviar alertas.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.children_alerts
    where checkin_id = p_checkin_id
      and sent_by = actor
      and created_at > now() - interval '15 seconds'
  ) then
    raise exception 'Aguarde alguns segundos antes de enviar outro alerta.' using errcode = 'P0001';
  end if;

  reason_label := case p_reason
    when 'needs_you' then 'Precisa de você na sala'
    when 'clothing_change' then 'Troca de roupa/fralda'
    when 'crying' then 'Está chorando'
    when 'minor_injury' then 'Machucou-se levemente'
  end;
  alert_message := case
    when reason_label is null then clean_note
    when clean_note is null then reason_label
    else reason_label || ': ' || clean_note
  end;

  select split_part(full_name, ' ', 1) into child_first_name from public.children where id = target.child_id;
  select name into class_name from public.children_classes where id = target.class_id;

  insert into public.children_alerts (child_id, guardian_id, sent_by, message, checkin_id, class_id, reason)
  select target.child_id, guardian.guardian_id, actor, alert_message, target.id, target.class_id, p_reason
  from public.child_guardians guardian
  where guardian.child_id = target.child_id;
  get diagnostics guardians_alerted = row_count;

  if guardians_alerted = 0 then
    raise exception 'Esta criança não tem responsáveis cadastrados.' using errcode = 'P0001';
  end if;

  -- The inbox copy respects the member preference; the alert banner always shows.
  insert into public.notifications (user_id, title, body, deep_link)
  select guardian.guardian_id,
    'Sementinhas: chamado para ' || child_first_name,
    alert_message || ' (' || class_name || ')',
    '/sementinhas'
  from public.child_guardians guardian
  join public.profiles profile on profile.id = guardian.guardian_id
  where guardian.child_id = target.child_id
    and profile.notifications_enabled;

  perform private.log_children_event('alert_sent', target.child_id, target.class_id, null,
    jsonb_build_object('checkin_id', target.id, 'reason', p_reason, 'guardians', guardians_alerted));
  return guardians_alerted;
end;
$$;

create function public.acknowledge_child_alert(p_alert_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  alert public.children_alerts%rowtype;
begin
  if actor is null then
    raise exception 'Entre na sua conta para continuar.' using errcode = '42501';
  end if;

  select * into alert from public.children_alerts where id = p_alert_id and guardian_id = actor for update;
  if not found then
    raise exception 'Alerta não encontrado.' using errcode = 'P0001';
  end if;
  if alert.acknowledged_at is not null then
    return;
  end if;

  update public.children_alerts set acknowledged_at = now() where id = p_alert_id;
  perform private.log_children_event('alert_acknowledged', alert.child_id, alert.class_id, actor,
    jsonb_build_object('alert_id', p_alert_id));
end;
$$;

revoke all on function public.register_child(text, date, text) from public, anon;
revoke all on function public.remove_child(uuid) from public, anon;
revoke all on function public.check_in_child(uuid, uuid) from public, anon;
revoke all on function public.check_out_child(uuid) from public, anon;
revoke all on function public.send_child_alert(uuid, text, text) from public, anon;
revoke all on function public.acknowledge_child_alert(uuid) from public, anon;
grant execute on function public.register_child(text, date, text) to authenticated;
grant execute on function public.remove_child(uuid) to authenticated;
grant execute on function public.check_in_child(uuid, uuid) to authenticated;
grant execute on function public.check_out_child(uuid) to authenticated;
grant execute on function public.send_child_alert(uuid, text, text) to authenticated;
grant execute on function public.acknowledge_child_alert(uuid) to authenticated;
