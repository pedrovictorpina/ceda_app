# Caixa e balcão

Uma única função da loja permite preparar/abrir/fechar o caixa, confirmar pagamentos, entregar pedidos, manter produtos e estoque e consultar relatórios. Na interface, o nome é **Caixa e balcão** e há um único controle em Pessoas e permissões.

`cashier` é o valor canônico no cliente. `counter` permanece como alias de compatibilidade; a hidratação e a listagem administrativa normalizam os dois valores, sem duplicar badges ou permissões. Administradores e pastores mantêm o acesso à loja, e membros comuns não ganham acesso à operação.

O banco considera os dois aliases equivalentes, inclusive para tokens emitidos antes da migração. O backfill completa o par em `user_system_roles` e `auth.users.raw_app_meta_data.roles` apenas para operadores já existentes. Outros papéis, metadados de Auth e auditoria das concessões existentes são preservados. O endpoint administrativo concede ou remove ambos em conjunto e restaura os registros alterados se a sincronização com Auth falhar.

A sequência do pedido continua sendo pagamento com forma registrada → pronto para retirada → entrega confirmada. Uma só pessoa pode fazer as duas etapas; as guardas, reservas e baixa de estoque continuam no banco. Não é permitido entregar um pedido que ainda aguarda pagamento.

## Publicação conjunta

A migração `20261018214842_unify_store_operator_role.sql` deve entrar na mesma janela da API administrativa nova. **Não aplicar a migração isoladamente enquanto a API antiga estiver recebendo alterações de permissões**: ela remove apenas um alias e deixaria o outro ativo. Evitar edições de papéis durante a janela; publicar a versão com a API pareada e aplicar a migração imediatamente em seguida, antes de liberar essas edições. Clientes antigos devem recarregar a interface administrativa.

A migração não altera pedidos, produtos, lotes ou saldos. A compatibilidade permite que o aplicativo anterior ainda leia os dois aliases enquanto a interface atualizada usa uma só função. Tokens antigos de operadores já têm direitos equivalentes no banco; a mudança visual depende de recarregar o perfil/interface. Revogações em Auth passam a valer nos tokens após a renovação da sessão, conforme o mecanismo existente do projeto.

## Validação

- Testes unitários: normalização, autorização, atalhos e concessão/revogação pareada na API, incluindo auditoria e rollback.
- `supabase/tests/unified_store_operator.test.sql`: pagamentos e entregas pelo mesmo caixa ou balcão legado; acesso a estoque, imagens e relatórios; proteção de membros e transições do pedido.
- Migração validada em PostgreSQL isolado com cenários de backfill e repetição idempotente. Nenhum pagamento ou entrega de teste precisa ser criado em produção para validar a autorização.

Verificação desta alteração: lint, typecheck e build aprovados; 295 testes unitários e 76 assertivas SQL passaram. No Chrome local, os perfis `cashier` e `counter` completaram pagamento e entrega e abriram estoque/relatórios em 390 px e 1440 px, com API simulada e sem transações reais. O PostgreSQL WASM executou todas as migrações, RLS e guardas; somente a extensão/agendamento `pg_cron` foi omitida nesse ambiente isolado. A conferência não substitui a validação do APK em aparelho físico.

Estado antes da publicação: migração e interface ainda locais. O dry-run remoto identificou somente esta migração pendente. A revisão não encontrou bloqueios no código novo; exige a publicação conjunta descrita acima.
