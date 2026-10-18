# Melhorias de usabilidade — CEDA

Data: 18/10/2026. Implementação local na branch `codex/nuxt-ui-project`, a partir da [avaliação inicial](auditoria-usabilidade-2026-10-18.md). O diagnóstico original foi preservado como registro histórico.

## Resultado e alcance

Os achados A01–A12 receberam alterações no código. O trabalho priorizou a confiança nas confirmações, a continuidade das tarefas, a informação publicada, a privacidade e os padrões compartilhados do Nuxt UI. O cadastro de endereço e contato oficial de recepção continua pendente de dados confirmados da igreja.

“10/10” é a meta de qualidade solicitada. Este registro não atribui uma nova nota: ainda não foram medidos conclusão de tarefas, esforço ou compreensão com usuários reais. A implementação local, os testes de lógica, os testes de políticas no banco e as verificações de navegador têm alcances diferentes, discriminados abaixo.

O projeto agora possui 40 rotas, incluindo Recuperar acesso, Escolher nova senha e Mensagens salvas. A avaliação e a implementação foram realizadas localmente. Após autorização explícita de publicação, a migração foi aplicada ao projeto de produção CEDA em 18/10/2026; os registros existentes foram preservados.

## Acompanhamento dos achados

| Achado | O que mudou | Situação e limite verificável |
| --- | --- | --- |
| **A01 — confirmações e persistência** | Solicitação de grupo grava `community_memberships`, permite cancelar o pedido pendente e apresenta o resultado da análise. Salvos usa lista individual em `saved_messages`, com destino `/salvos`. Publicações, curtidas e comentários usam registros do servidor; contagens são consultadas após confirmação. Preferência de aviso usa `event_reminders`; o alerta de calendário é oferecido por arquivo ICS. | Implementado e coberto por testes de lógica e políticas locais. A interface distingue guardar preferência de receber alerta: não promete push. A entrega do alerta depende da importação no calendário e das permissões do aparelho; não foi homologada em dispositivo real. |
| **A02 — fonte das publicações e agenda** | Início, leitura, notícias e destaques consultam publicações vigentes. A agenda usa `events`, com cancelamentos, mês anterior/próximo, datas de Brasília e o mesmo filtro na lista e no mês. O próximo culto é calculado a partir dos eventos publicados. Campanhas usam valores publicados e data de atualização. Conteúdo demonstrativo deixou de substituir silenciosamente falhas de consulta. | Implementado; regras de datas, consultas e leitura pública testadas. A sincronização entre edição administrativa e navegação autenticada ainda requer homologação com uma instância Supabase integrada e dados controlados. A superfície pública se restringe a cultos explicitamente públicos, sem vínculos privados. |
| **A03 — recuperação e continuidade** | “Esqueci minha senha”, recuperação por e-mail, definição de nova senha, mensagens compreensíveis, reenvio de confirmação e limitação de repetição. O destino interno é conservado ao exigir entrada, inclusive durante a recuperação, com validação contra redirecionamento externo. Falha de logout preserva a sessão e orienta tentar novamente. | Implementado; validações e contratos do cliente de autenticação testados. Entrega real de e-mail, SMTP, URLs autorizadas no painel Supabase e conclusão do fluxo pelo link recebido não foram verificadas. |
| **A04 — primeira visita e atendimento** | Cabeçalho público oferece caminhos institucionais. Horários e contato reúnem próximo encontro, orientação da visita e canais oficiais. Há suporte a endereço, mapa, telefone, WhatsApp e e-mail de recepção por configuração. A falta desses dados aparece de forma explícita, com alternativa para o Instagram oficial. | **Parcial por dependência de dados oficiais.** O caminho foi implementado; endereço e contato direto de recepção não foram inventados. A página de produção consultada ainda não expõe esses dados. |
| **A05 — contraste primário** | Primário do tema claro usa laranja mais escuro; o tema escuro usa texto invertido compatível. Hover e foco acompanham o padrão. Consumidores compartilhados com fundo primário usam texto/ícone invertido. | Medição real do botão de entrada: **5,22:1 no claro e 7,45:1 no escuro**. O par medido supera 4,5:1. Não equivale a uma auditoria WCAG completa de todas as cores, estados, imagens e páginas. |
| **A06 — conforto no celular** | Configuração compartilhada amplia botões, campos e seletores no celular; mantém fonte legível e alvos de pelo menos 44 px nos controles tratados. | Botão “Entrar” medido em **326 × 44 px**. Nove páginas públicas verificadas sem rolagem horizontal em 320 e 768 px; matriz desktop em conclusão no momento deste registro. Teclado virtual, precisão de toque e Capacitor em aparelho físico continuam pendentes. |
| **A07 — descoberta e contexto** | “Grupos e ministérios” e “Mural da comunidade” explicitam as funções; Células explica os encontros nas casas. Busca disponível no desktop e no menu móvel, com palavras alternativas e Salvos encontrável. Turmas preserva o contexto de gestão para administradores. Ferramentas de interface saíram do menu comum do membro. Atalho permite pular para o conteúdo. | Implementado; correspondência de rotas, busca, palavras alternativas e barra por perfil cobertas por testes. Clareza dos nomes e aprendizagem ainda precisam de observação com membros, responsáveis e equipe. |
| **A08 — preservação do trabalho** | Carrinho recuperado durante a sessão do navegador, isolado por conta, com prazo de 24 horas, dados mínimos e limpeza no logout/troca. Estoque e preço vêm do catálogo atual; falha de atualização mantém o pedido. “Desfazer” não restaura dados em outra conta. Editor de conteúdo, oração, perfil e conversas protegem rascunhos/alterações; comentários têm rascunhos separados por publicação. | Implementado nos fluxos citados, com testes de isolamento, expiração, reconciliação e falhas. O carrinho não é sincronizado entre aparelhos. Os rascunhos de texto citados são mantidos enquanto a página permanece aberta e protegidos por aviso ao sair; não há promessa de recuperação de todos os formulários após fechar o navegador. |
| **A09 — falha, vazio e recuperação** | Oração, notificações, perfil e consultas editoriais/agenda têm carregamento, erro e próxima ação. Oração valida título junto ao campo. Notificações tem atualização, paginação e confirma leitura somente após gravação. Perfil evita salvar dados que não foram carregados corretamente. Consultas com falha não viram listas vazias definitivas nem dados de reserva apresentados como atuais. | Implementado; testes simulam falha de rede, respostas fora de ordem e confirmação de gravação. A preservação de conteúdo conhecido depende do fluxo: as telas deixam claro quando não foi possível atualizar. Conexão ruim em aparelho real e recuperação após suspensão prolongada não foram homologadas. |
| **A10 — linguagem e próximo passo** | Textos de perfil, cadastro, notificações e editor administrativo passaram a explicar tarefa, público e próxima ação. Notificações informa que os avisos são internos ao app. O editor oferece prévia e explica publicação/agendamento. Cadastro diferencia confirmação de e-mail de acesso disponível. | Implementado. A compreensão com pessoas pouco familiarizadas com tecnologia permanece uma hipótese a validar; não foi substituída por uma nota automática. |
| **A11 — prevenção de enganos** | Conceder/remover acesso de administrador ou pastor exige resumo da pessoa, papel e consequência. Entrega mostra conferência do pedido antes de concluir. A atualização do pedido exige o estado original; atendimento concorrente gera orientação de atualizar. Limpeza e isolamento de estado preservam os contextos das contas. | Implementado. Não foram alterados papéis de pessoas reais, confirmados pagamentos, entregues pedidos nem modificados estoques para validação. Exige homologação operacional com dados controlados e os perfis corretos. |
| **A12 — data e teclado** | `AppDatePicker` passou a usar entrada digitável por segmentos em português, mantendo o calendário. Cartões da equipe têm controles separados para conhecer a história e abrir Instagram, eliminando a ação concorrente do cartão pai. | No navegador, **23/04/1990 foi digitado** e o calendário abriu em **abril de 1990**, conservando o valor. Leitor de tela, ampliação de texto e a experiência do teclado virtual em aparelho físico ainda não foram testados integralmente. |

## Evidências de validação

### Navegador real local

- `/entrar`, no celular: botão de 326 × 44 px; texto branco sobre fundo computado RGB(202, 53, 0) no tema claro, contraste calculado de 5,22:1. Tema escuro: 7,45:1. Medição baseada em cores computadas e luminância relativa, sem amostragem de pixels suavizados.
- Cadastro: digitação de 23/04/1990 no campo de nascimento e abertura do calendário em abril de 1990.
- Nove páginas públicas: início, entrada, cadastro, recuperação, redefinição, horários, sobre, contato e privacidade. **36 verificações concluídas em 320, 768, 1024 e 1440 px**, sem transbordamento horizontal ou página de erro e com título principal disponível.
- A matriz pública não representa execução das tarefas autenticadas nem uma validação em celular físico.

Os resultados de contraste se referem ao par efetivamente medido. Referência: [W3C — contraste mínimo de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). O uso de 44 px é uma escolha de conforto alinhada ao critério ampliado da [W3C — tamanho de alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html); esse valor não foi apresentado como o mínimo AA geral.

### Testes de lógica e consultas simuladas

- Rodada global final após a revisão independente: **251 testes passaram em 28 arquivos**, executando o comando padrão `npm run test`.
- Revisão de interações de membros: **10 cenários novos passaram** em `tests/memberActions.test.ts`, incluindo troca de conta, retorno A→B→A, respostas antigas, gravação confirmada com falha posterior de contagem, comentários em publicações diferentes e paginação de link compartilhado.
- Navegação e carrinho: **17 testes focados passaram**, incluindo correspondência de rotas, busca, preços/estoque atuais, isolamento de conta, logout, expiração, armazenamento inválido ou bloqueado. Essas contagens são execuções de escopos específicos, não uma soma anunciada como total global final.
- **Lint global, typecheck e build de produção passaram na versão final**, após o congelamento do código. O servidor de desenvolvimento foi encerrado durante o build para evitar conflito de arquivos gerados. O pacote Nitro resultante tem aproximadamente 10,8 MB (2,54 MB gzip).
- O pool padrão do Vitest foi definido como `threads`: workers em processos separados referenciavam arquivos temporários inacessíveis no sandbox Windows. O comando padrão agora executa a suíte completa de forma reproduzível, sem flags especiais.
- Os testes de composables usam respostas controladas do cliente para reproduzir erros e concorrência; não se apresentam como um teste E2E Supabase.

### Banco de dados e políticas

Os scripts das **18 migrações** foram carregados em **PostgreSQL WASM/PGlite**, com fixtures locais para `auth` e `storage`. Somente duas instruções relacionadas a `pg_cron`, indisponível nesse ambiente, foram omitidas na execução. Essa exceção não valida agendamento ou entrega de avisos.

Foram executadas **33 assertivas dos dois arquivos SQL do repositório**, com consultas reais e papéis, grants e RLS ativos:

- `supabase/tests/usability_member_actions.test.sql`: **25 assertivas** sobre salvos por conta, acesso anônimo, conteúdo não publicado/futuro, interações em publicações legíveis, privacidade no destino de UPDATE, contagens e validação de texto.
- `supabase/tests/public_agenda_access.test.sql`: **8 assertivas** sobre leitura pública de cultos, exclusão de cancelados ou vinculados a grupos privados, e restrição de colunas sensíveis.

Um runner Node traduziu os wrappers pgTAP para assertivas Node e executou o SQL contra o banco WASM. **Não foi uma execução nativa do pgTAP, uma instância Supabase completa ou uma integração com PostgREST/GoTrue.** O Docker local falhou na inicialização do serviço de inferência; não foi usado como evidência de aprovação.

### Produção e dados oficiais

O destino padrão de site foi alinhado a [https://ceda-app-beige.vercel.app](https://ceda-app-beige.vercel.app), conforme indicação do responsável pelo projeto. A consulta em navegador à [página de contato em produção](https://ceda-app-beige.vercel.app/contato) não apresentou endereço ou um canal direto de recepção; os dados precisam ser confirmados e configurados no ambiente apropriado.

Essa leitura verificou a configuração/informação publicada existente. Na etapa de publicação autorizada, a migração `20261018194729_usability_member_actions` foi aplicada pelo CLI ao projeto CEDA, sem seeds. O histórico remoto ficou alinhado às 18 migrações locais. Foram conferidos o RLS de mensagens salvas, as três políticas por conta, as restrições de acesso anônimo e as colunas públicas da agenda. O Site URL de autenticação já aponta para o domínio oficial da Vercel. A entrega efetiva de e-mail não foi exercitada.

A versão de publicação é **0.2.0**; o andamento e a prontidão do deploy devem ser confirmados na Vercel. Não foram cadastrados dados oficiais ausentes, enviadas mensagens à recepção nem alterados registros operacionais para teste.

## Arquivos centrais da mudança

| Área | Referências |
| --- | --- |
| Tema, formulários e navegação | `app/app.config.ts`, `app/assets/css/main.css`, `app/components/navigation/`, `app/composables/useAppNavigation.ts`, `app/utils/navigation.ts`, `app/components/AppDatePicker.vue` |
| Entrada, recuperação e visita | `app/stores/auth.ts`, `app/middleware/auth.ts`, `app/utils/authFlow.ts`, `app/pages/recuperar-senha.vue`, `app/pages/redefinir-senha.vue`, `app/composables/useOfficialLinks.ts`, `app/utils/officialContact.ts`, `app/pages/contato.vue`, `app/pages/horarios-de-culto.vue` |
| Publicação e agenda | `app/composables/usePublishedEditorial.ts`, `app/composables/useChurchAgenda.ts`, `app/composables/useEventReminders.ts`, `app/utils/churchAgenda.ts`, `app/pages/admin/agenda.vue`, `app/pages/admin/conteudo.vue` |
| Participação, salvos e avisos | `app/composables/useSavedMessages.ts`, `app/composables/useCommunityFeed.ts`, `app/composables/usePrayerRequests.ts`, `app/composables/useInternalNotifications.ts`, `app/composables/useProfileDetails.ts`, `app/pages/salvos.vue`, `app/components/AppUnsavedChanges.vue` |
| Carrinho e operação | `app/utils/storeCartDraft.ts`, `app/plugins/store-cart.client.ts`, `app/pages/loja.vue`, `app/pages/admin/pessoas.vue`, `app/pages/operacao/index.vue` |
| Banco | `supabase/migrations/20261018194729_usability_member_actions.sql`, `supabase/tests/usability_member_actions.test.sql`, `supabase/tests/public_agenda_access.test.sql` |

## Pendências para homologação e publicação

1. Homologar os fluxos autenticados completos pelo cliente Supabase/PostgREST, incluindo troca de conta, publicação/cancelamento, solicitação/análise e retorno após falha de rede. A migração já foi aplicada e suas permissões foram conferidas em produção.
2. Validar SMTP e URLs de retorno com e-mail de teste, link de recuperação, senha expirada, reenvio e retorno à tarefa original. Não registrar tokens ou credenciais nas evidências.
3. Confirmar endereço, mapa e contato público oficial da recepção; configurar somente dados autorizados da igreja. O Instagram oficial é alternativa explícita enquanto esses dados faltam.
4. Homologar importação de calendário, notificações internas, teclado virtual, leitor de tela, texto ampliado e experiência Capacitor/APK em aparelho físico.
5. Observar pessoas representativas dos perfis de visitante, membro, responsável, líder/professor, caixa/balcão e administrador. Medir conclusão sem ajuda, desvios, erros, recuperação e compreensão do público das ações.

A publicação exige os dados e a configuração adequados. Só os testes com pessoas permitirão substituir a estimativa heurística original por evidências de intuitividade observada.
