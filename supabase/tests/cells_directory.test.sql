begin;
select plan(48);

-- Estrutura -----------------------------------------------------------------------
select has_table('public', 'cell_visit_requests', 'visit requests exist');
select has_column('public', 'cell_addresses', 'neighborhood', 'cell addresses store the neighborhood');
select has_column('public', 'cells', 'show_full_address_to_members', 'cells store the address visibility choice');
select has_column('public', 'cell_leaders', 'whatsapp', 'leaders store a public WhatsApp');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.cell_visit_requests'::regclass),
  'visit requests use RLS'
);
select is(
  (
    select count(*)::integer
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'cell_visit_requests'
      and (grantee = 'anon' or (grantee = 'authenticated' and privilege_type <> 'SELECT'))
  ),
  0,
  'visit requests are read-only for clients and hidden from anon'
);
select is(
  (
    select count(*)::integer
    from pg_proc function_definition
    join pg_namespace namespace on namespace.oid = function_definition.pronamespace
    where namespace.nspname = 'public'
      and function_definition.proname in (
        'list_cell_directory', 'update_cell_leader_profile', 'search_members_for_cell', 'add_cell_member',
        'remove_cell_member', 'request_cell_visit', 'list_cell_visit_requests', 'update_cell_visit_request',
        'update_cell_details', 'create_cell_with_details'
      )
      and 'search_path=""' = any(function_definition.proconfig)
  ),
  10,
  'every new cell RPC pins an empty search_path'
);
select ok(
  not has_function_privilege('anon', 'public.list_cell_directory(uuid)', 'execute'),
  'anonymous visitors cannot read the cell directory'
);

-- Pessoas ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data) values
  ('20000000-0000-0000-0000-000000000001', 'manager@dir.test', '{"roles":["administrator"]}'),
  ('20000000-0000-0000-0000-000000000002', 'leader@dir.test', '{}'),
  ('20000000-0000-0000-0000-000000000003', 'coleader@dir.test', '{}'),
  ('20000000-0000-0000-0000-000000000004', 'visitor@dir.test', '{}'),
  ('20000000-0000-0000-0000-000000000005', 'member@dir.test', '{}');

insert into public.profiles (id, full_name, email, phone, notifications_enabled) values
  ('20000000-0000-0000-0000-000000000001', 'Gestora Diretório', 'manager@dir.test', null, true),
  ('20000000-0000-0000-0000-000000000002', 'Líder Ana', 'leader@dir.test', null, true),
  ('20000000-0000-0000-0000-000000000003', 'Colíder Bruno', 'coleader@dir.test', null, false),
  ('20000000-0000-0000-0000-000000000004', 'Visitante João', 'visitor@dir.test', '(11) 98888-7777', true),
  ('20000000-0000-0000-0000-000000000005', 'Membro Carla', 'member@dir.test', null, true);

-- Administração cria a célula com endereço -----------------------------------------
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{"roles":["administrator"]}}', true);
set local role authenticated;

select lives_ok(
  $$select public.create_cell_with_details('Célula Diretório', 'Encontro de amigos', 4::smallint, '20:00'::time,
    array['20000000-0000-0000-0000-000000000002'::uuid, '20000000-0000-0000-0000-000000000003'::uuid], true,
    'Rua das Flores, 100', 'Jardim Paulista', 'São Paulo', 'SP', '01415000')$$,
  'a manager creates a cell with address in one call'
);
select is(
  (select postal_code || ' / ' || neighborhood from public.cell_addresses),
  '01415-000 / Jardim Paulista',
  'the postal code is normalized and the neighborhood saved'
);
select lives_ok(
  $$select public.add_cell_member((select id from public.communities where name = 'Célula Diretório'), '20000000-0000-0000-0000-000000000005')$$,
  'a manager adds a member directly'
);

-- Liderança edita os dados e o próprio perfil ----------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;

select lives_ok(
  $$select public.update_cell_details((select id from public.communities where name = 'Célula Diretório'),
    'Célula Esperança', 'Nova descrição', 4::smallint, '19:30'::time, true, false,
    'Rua das Flores, 100', 'Jardim Paulista', 'São Paulo', 'SP', null)$$,
  'a leader edits name, schedule, address and hides the full address'
);
select throws_ok(
  $$select public.update_cell_details((select community_id from public.cells limit 1),
    'X', null, 4::smallint, null, true, true, null, null, null, null, null)$$,
  '22023',
  'a too-short cell name is rejected'
);
select throws_ok(
  $$select public.update_cell_details((select community_id from public.cells limit 1),
    'Célula Esperança', null, 4::smallint, null, true, true, 'Rua A, 1', null, 'São Paulo', 'SP', null)$$,
  '22023',
  'an address without neighborhood is rejected'
);
select lives_ok(
  $$select public.update_cell_leader_profile((select community_id from public.cells limit 1),
    '20000000-0000-0000-0000-000000000002', 'Casada, mãe de dois, ama louvor.', '(11) 99999-0000', '@ana.lider')$$,
  'a leader edits their own public profile'
);
select is(
  (select whatsapp || ' ' || instagram from public.cell_leaders where user_id = (select auth.uid())),
  '5511999990000 ana.lider',
  'WhatsApp is stored in E.164 digits and Instagram without @'
);
select throws_ok(
  $$select public.update_cell_leader_profile((select community_id from public.cells limit 1),
    '20000000-0000-0000-0000-000000000002', null, '12345', null)$$,
  '22023',
  'an invalid WhatsApp is rejected'
);
select throws_ok(
  $$select public.update_cell_leader_profile((select community_id from public.cells limit 1),
    '20000000-0000-0000-0000-000000000003', 'Tentativa', null, null)$$,
  '42501',
  'a leader cannot edit another leader profile'
);

-- Diretório visto por quem não participa ---------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000004","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;

select is((select count(*)::integer from public.cells), 0, 'the private cells table stays hidden from non-members');
select is((select count(*)::integer from public.list_cell_directory()), 1, 'the directory lists the active cell');
select is((select address_line from public.list_cell_directory()), null, 'the full address is hidden when the leadership chose so');
select is((select neighborhood || ', ' || city from public.list_cell_directory()), 'Jardim Paulista, São Paulo', 'neighborhood and city remain visible');
select is((select jsonb_array_length(leaders) from public.list_cell_directory()), 2, 'the directory lists both leaders');
select is(
  (select leader ->> 'whatsapp' from public.list_cell_directory() entry, jsonb_array_elements(entry.leaders) leader where leader ->> 'full_name' = 'Líder Ana'),
  '5511999990000',
  'leader contact is visible to authenticated members'
);
select is((select relationship from public.list_cell_directory()), null, 'the visitor has no relationship with the cell');
select throws_ok(
  $$select * from public.search_members_for_cell((select cell_id from public.list_cell_directory()), 'Car')$$,
  '42501',
  'a non-leader cannot search members'
);

-- Pedido de visita ------------------------------------------------------------------------
select lives_ok(
  $$select public.request_cell_visit((select cell_id from public.list_cell_directory()), 'Gostaria de conhecer!', null, true)$$,
  'a visitor requests a visit'
);
select throws_ok(
  $$select public.request_cell_visit((select cell_id from public.list_cell_directory()), null, null, false)$$,
  'P0001',
  'a second open request for the same cell is rejected'
);
select throws_ok(
  $$select public.request_cell_visit((select cell_id from public.list_cell_directory()), null, current_date - 3, false)$$,
  '22023',
  'a preferred date in the past is rejected'
);
select is(
  (select my_visit_request ->> 'status' from public.list_cell_directory()),
  'pending',
  'the requester sees the status of their request'
);
select throws_ok(
  $$insert into public.cell_visit_requests (cell_id, requester_id) select cell_id, (select auth.uid()) from public.list_cell_directory()$$,
  '42501',
  'clients cannot insert visit requests directly'
);

reset role;
select is(
  (select count(*)::integer from public.notifications where title = 'Pedido de visita'),
  1,
  'only the leader who accepts notifications is notified'
);
select is(
  (select deep_link like '/celulas/%?visita=%' from public.notifications where title = 'Pedido de visita'),
  true,
  'the notification links to the cell page'
);

-- Membro aprovado não pede visita ------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000005","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select throws_ok(
  $$select public.request_cell_visit((select cell_id from public.list_cell_directory()), null, null, false)$$,
  'P0001',
  'a member of the cell cannot request a visit'
);
select is((select address_line from public.list_cell_directory()), 'Rua das Flores, 100', 'members still see the full address');
select throws_ok(
  $$select * from public.list_cell_visit_requests((select cell_id from public.list_cell_directory()))$$,
  '42501',
  'a plain member cannot list visit requests'
);

-- Liderança trata o pedido -------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;

select is(
  (select requester_name || ' ' || requester_phone from public.list_cell_visit_requests((select community_id from public.cells limit 1))),
  'Visitante João 5511988887777',
  'leaders see the requester and the phone the requester chose to share'
);
select lives_ok(
  $$select public.update_cell_visit_request((select id from public.cell_visit_requests limit 1), 'contacted')$$,
  'a leader marks the request as contacted'
);
select throws_ok(
  $$select * from public.search_members_for_cell((select community_id from public.cells limit 1), 'J')$$,
  '22023',
  'member search needs at least two characters'
);
select is(
  (select full_name from public.search_members_for_cell((select community_id from public.cells limit 1), 'joao')),
  'Visitante João',
  'member search ignores accents and case and skips current members'
);
select lives_ok(
  $$select public.add_cell_member((select community_id from public.cells limit 1), '20000000-0000-0000-0000-000000000004')$$,
  'a leader adds the visitor to the cell'
);
select is(
  (select status::text from public.cell_visit_requests limit 1),
  'closed',
  'adding the visitor closes the open visit request'
);
select throws_ok(
  $$select public.remove_cell_member((select community_id from public.cells limit 1), '20000000-0000-0000-0000-000000000003')$$,
  'P0001',
  'a leader cannot remove another leader'
);
select lives_ok(
  $$select public.remove_cell_member((select community_id from public.cells limit 1), '20000000-0000-0000-0000-000000000005')$$,
  'a leader removes a member'
);

reset role;
select is(
  (select count(*)::integer from public.administrative_audit_log where action = 'cell_member_added' and actor_id = '20000000-0000-0000-0000-000000000002'),
  1,
  'leader additions are audited'
);
select is(
  (select count(*)::integer from public.administrative_audit_log where action = 'cell_member_removed' and subject_user_id = '20000000-0000-0000-0000-000000000005'),
  1,
  'leader removals are audited'
);

-- Limite diário ------------------------------------------------------------------------
insert into public.communities (id, name, visibility, created_by)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, 'Célula extra ' || n, 'private', '20000000-0000-0000-0000-000000000001'
from generate_series(1, 6) n;
insert into public.cells (community_id, updated_by)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, '20000000-0000-0000-0000-000000000001'
from generate_series(1, 6) n;
insert into public.cell_visit_requests (cell_id, requester_id, status, handled_at)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, '20000000-0000-0000-0000-000000000005', 'closed', now()
from generate_series(1, 5) n;

select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000005","role":"authenticated","app_metadata":{"roles":["member"]}}', true);
set local role authenticated;
select throws_ok(
  $$select public.request_cell_visit('30000000-0000-0000-0000-000000000006', null, null, false)$$,
  'P0001',
  'a sixth visit request in the same day is rejected'
);
select throws_ok(
  $$select public.update_cell_visit_request((select id from public.cell_visit_requests where requester_id = '20000000-0000-0000-0000-000000000005' limit 1), 'contacted')$$,
  '42501',
  'a requester cannot mark their own request as contacted'
);

select * from finish();
rollback;
