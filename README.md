# CEDA

Fundação executável de um único produto Nuxt para o site público, área de membros, painel administrativo, PWA e aplicativos Capacitor. Esta etapa modela os domínios e entrega telas-base; não representa o produto final nem contém dados reais da igreja.

## Stack e requisitos

- Node.js 22.12 ou superior (o desenvolvimento inicial foi validado com Node 24)
- Nuxt 4, Vue 3 e TypeScript estrito
- Nuxt UI 4 com Tailwind CSS 4
- Pinia somente para sessão/perfil global
- Supabase (Auth, Postgres, Storage e Realtime)
- Vite PWA e Capacitor 8
- Docker Desktop para executar o Supabase local

## Instalação local

```bash
npm install
copy .env.example .env
npm run dev
```

As chaves em `.env.example` são placeholders. Use somente a URL e a chave `publishable` do projeto. Nunca coloque `service_role`, secret key ou credenciais de lojas em variáveis `NUXT_PUBLIC_*`.

Comandos principais:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run generate
```

Não execute `build` ou `generate` ao mesmo tempo que `dev`: os modos compartilham artefatos em `.nuxt` e uma geração concorrente pode invalidar aliases do Vite, como `#app-manifest`. Se isso ocorrer, pare somente o servidor deste projeto e execute:

```bash
npm run clean
npm run postinstall
npm run dev
```

### Testes E2E

Playwright usa uma build própria na porta `4318`, gera relatório HTML em `output/playwright/report` e recusa iniciar se o servidor manual estiver ativo na porta 3000. Isso evita que `build` e `dev` disputem `.nuxt`.

```bash
# pare temporariamente o dev da porta 3000
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
# depois reinicie a prévia manual
npm run dev -- --host 127.0.0.1 --port 3000
```

A suíte usa Chromium isolado, não depende de dados externos e cria no Supabase local apenas uma conta aleatória de teste quando o serviço está disponível.

## Supabase local

O CLI está fixado no projeto. Descubra opções pela ajuda (`npx supabase --help`) antes de usar comandos novos.

```bash
npm run db:start
npx supabase db reset
npm run db:test
npm run db:stop
```

A migration inicial está em `supabase/migrations/`. `supabase/config.toml` desliga a exposição automática de tabelas: grants e RLS são explícitos. Todas as tabelas no schema público têm RLS. Os testes pgTAP em `supabase/tests/` validam a presença da proteção; para uma homologação real, amplie-os com usuários e cenários allow/deny.

### Autenticação e autorização

- O cliente usa PKCE e somente a chave pública.
- “Lembrar meu acesso” controla onde a sessão do Supabase é persistida: no APK, usa as preferências nativas do aplicativo; no navegador, usa `localStorage`. Ao desmarcar, usa `sessionStorage`, encerrado com a aba. O SDK exige `persistSession: true` para gerenciar/renovar a sessão, por isso um storage customizado seleciona a duração. Sessões de versões antigas do APK são migradas do WebView quando ainda existem. Senhas nunca são armazenadas.
- Cadastro usa `signUp` e guarda em `user_metadata` somente nome/telefone e, opcionalmente, data de nascimento e o consentimento “Quero receber felicitações” para criar o perfil no primeiro acesso confirmado. Autorização continua exclusivamente fora de `user_metadata`. Com confirmação de e-mail habilitada, o perfil é criado após confirmar e entrar; com autoconfirmação local, é criado imediatamente.
- A tabela `profiles` guarda dados pessoais; idade nunca é persistida, apenas derivada de `birth_date`.
- Papéis do sistema (`member`, `administrator`, `pastor`, `cashier`, `counter`, `teacher`) são separados de tags/cargos e participações em ministérios.
- Políticas privilegiadas leem `app_metadata.roles`, nunca `user_metadata`. A rota protegida `POST /api/admin/roles` atualiza essa metadata e a tabela `user_system_roles` sem expor a credencial administrativa ao navegador. Ela exige `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente do servidor (local ou Vercel), além da URL e chave pública já configuradas.
- Apenas quem já possui `administrator` em `app_metadata.roles` pode conceder ou remover `administrator` e `pastor`; a API valida o JWT no Supabase, impede autoalteração e mantém o papel-base `member`. Após a alteração, a pessoa afetada deve renovar a sessão ou entrar novamente. Tokens de acesso emitidos antes da mudança permanecem válidos até expirar, portanto configure uma expiração curta de JWT no Supabase para revogações mais rápidas.
- O Perfil oferece um link fixo de convite para `https://ceda-app-beige.vercel.app/cadastro?convite=ceda`, uma variação para convite familiar e imagens horizontal ou vertical com QR Code. Convites apenas direcionam ao cadastro completo: não carregam papéis nem elevam permissões. Toda conta entra como `member`; outros papéis continuam exclusivos da alteração feita por administrador.
- As funções auxiliares usadas nas policies são `SECURITY INVOKER`. Operações atômicas (caixa da loja, Sementinhas) usam RPCs `SECURITY DEFINER` com `search_path` vazio, verificação explícita do chamador e execução revogada de `anon`.
- Middleware de rota melhora UX, mas não é fronteira de segurança. RLS é a proteção efetiva.
- Células têm cadastro administrativo, líderes designados, endereço privado, membros, convites para usuários já cadastrados, comunicados e enquetes. Líderes gerenciam somente as próprias células; membros veem somente células das quais participam; convidados pendentes veem o convite, mas não o endereço.
- Diretório de células (`/celulas`, aba “Encontrar célula”): todo membro autenticado vê as células ativas pela RPC `SECURITY DEFINER` `list_cell_directory`, com nome, dia/horário, bairro/cidade, líderes (foto, resumo, WhatsApp e Instagram) e o status do próprio pedido de visita. O endereço completo só aparece quando a liderança mantém `cells.show_full_address_to_members` ligado (padrão) ou para membros/líderes/administração; o endereço abre no Google Maps. O RLS de `cells`, `cell_addresses` e `cell_leaders` não foi afrouxado.
- Líderes editam os dados da própria célula (`update_cell_details`), o próprio perfil de líder (`update_cell_leader_profile`; a administração edita qualquer líder), buscam pessoas cadastradas pelo nome (`search_members_for_cell`, mínimo 2 letras, até 20 resultados) e adicionam/removem membros (`add_cell_member`, `remove_cell_member`; líderes não removem outros líderes). Adições e remoções entram em `administrative_audit_log`.
- “Quero visitar essa célula” (`request_cell_visit`): um pedido em aberto por pessoa e célula, até 5 pedidos por dia, notificação interna para os líderes que aceitam notificações e telefone visível para a liderança somente se a pessoa escolher compartilhar. A liderança trata os pedidos em “Pedidos de visita” (`list_cell_visit_requests`, `update_cell_visit_request`).
- A publicação de comunicado de célula cria notificações internas para membros e colíderes. Push externo permanece uma integração futura e não é simulado nem anunciado como enviado.
- A migration de Células foi criada e validada somente no Supabase local. Aplicá-la ao projeto cloud exige uma publicação explícita e separada; este repositório não faz link ou `db push` automaticamente.
- Sementinhas (antigo “Ovelhinhas”; `/ovelhinhas` redireciona para `/sementinhas`): qualquer membro cadastra os próprios filhos (nome, data de nascimento, alergias e foto opcionais) e vira responsável automaticamente, sem aprovação. A idade é sempre derivada de `birth_date`. Professores (papel `teacher`, concedido em Pessoas e permissões; a tabela legada `children_team_members` continua valendo) criam turmas com faixa “de X a Y anos”, adicionam crianças, acompanham a salinha em `/sementinhas/turmas` e chamam os responsáveis. Check-in/check-out, alertas, cadastro e remoção passam por RPCs `SECURITY DEFINER` (`register_child`, `remove_child`, `check_in_child`, `check_out_child`, `send_child_alert`, `acknowledge_child_alert`) que validam o chamador; o banco garante um único check-in aberto por criança e registra tudo em `children_audit_log`. Crianças, alergias, vínculos, turmas e alertas não são públicos.
- Aniversariantes (`/aniversariantes`, todos os membros): lista de hoje, da semana (segunda a domingo) e do mês, calculados em `America/Sao_Paulo` pela RPC `SECURITY DEFINER` `list_birthdays(p_period)`, que retorna só nome, foto e dia/mês de quem ativou `profiles.birthday_greetings_opt_in` (padrão desligado). O RLS de `profiles` não foi afrouxado; ano e idade nunca saem do banco. Nascidos em 29/02 comemoram em 28/02 nos anos não bissextos. A arte exportável (16:9 1920×1080 ou Story 1080×1920, com margens de 250 px no topo e na base) é desenhada em Canvas no navegador; acima de 12 pessoas vira várias imagens equilibradas. No app nativo, baixar/compartilhar usa `@capacitor/filesystem` + `@capacitor/share`.
- Solicitar exclusão cria um registro confirmado e auditável. Não apaga automaticamente a conta ou dados; o procedimento definitivo depende de política de retenção e revisão administrativa/jurídica.

### Storage e Realtime

Buckets privados previstos: `avatars`, `message-media`, `feed-media`, `child-private` e `child-photos`. As policies restringem escrita por proprietário/gestor; `child-private` segue limitado a administradores. `child-photos` (5 MB, JPG/PNG/WebP, caminho `<id da criança>/…`) é lido por URL assinada pelos responsáveis da criança, professores e administradores; só responsáveis e administradores enviam ou trocam fotos. Upsert de avatar tem SELECT/INSERT/UPDATE conforme exigido pelo Storage. Realtime está habilitado somente para mensagens, eventos, notificações e alertas infantis.

## Estrutura

```text
app/
  components/navigation/  shell web/mobile
  composables/             navegação e links oficiais
  layouts/                 público, membro e admin
  middleware/              autenticação, admin e professores do Sementinhas
  pages/                   rotas-base do produto
  services/                adapters externos e push
  stores/                  sessão/perfil Pinia
  types/                   contratos de domínio
supabase/
  migrations/              schema, grants e RLS
  tests/                   verificações pgTAP
tests/                     regras puras Vitest
```

## PWA e aplicativos

O manifest, service worker e tema inicial estão configurados. A logo oficial em `public/brand/ceda-logo.jpg` já identifica o site, o favicon e o manifest. Antes de homologar a instalação, ainda produza a partir da identidade aprovada os PNGs 192/512, ícone maskable e splash definitivos.

```bash
npx cap add android
npx cap add ios
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Por padrão, o APK carrega a aplicação publicada em `https://ceda-app-beige.vercel.app` no WebView, assim toda atualização publicada no site chega ao aplicativo sem uma nova compilação. Defina `CAPACITOR_SERVER_URL` para apontar outro ambiente. Para gerar uma variante com os arquivos estáticos embarcados, defina `CAPACITOR_USE_BUNDLED_WEB=true` e execute `npm run mobile:sync`.

O `appId` atual (`org.example.ceda`) é placeholder obrigatório de troca antes de criar builds de loja. Não adicione plataformas nativas antes de confirmar:

- bundle/application ID definitivo;
- contas Google Play e Apple Developer;
- assinatura Android, keystore e gestão segura de senhas;
- certificados, profiles e assinatura iOS;
- ícones, splash screens, screenshots, textos e URLs legais;
- comportamento de deep links/universal links e push real.

O projeto não depende de CI. Codemagic pode futuramente executar o build/assinatura iOS sem Mac local, desde que os arquivos nativos, certificados e segredos sejam configurados no cofre da plataforma; não há pipeline ou segredo incluído agora.

## Conteúdo e integrações

- Palavra do Dia e Notícias reutilizam `daily_messages`, autoria, agendamento e histórico por `content_type`.
- Horários de Culto reutilizam `events`, recorrência e `church_locations`.
- Galeria usa `NUXT_PUBLIC_GALLERY_URL` por adapter externo; as imagens não vão para o Supabase. Links do Google Drive podem falhar por permissão, cookies ou bloqueio de embedding. Prefira link HTTPS público somente quando aprovado e troque o provider sem mudar a tela.
- Instagram (`https://www.instagram.com/igrejaceda/`) e YouTube (`https://www.youtube.com/@IgrejaCEDA`) têm links oficiais centralizados no runtime config, com override opcional por env. A futura sincronização de feed usa contratos separados.
- Campanhas exibem meta e progresso informativos. Não há pagamento nem gateway.
- Contatos oficiais exigem consentimento registrado; contatos pessoais de membros não são publicados por padrão.
- Endereços oficiais ficam em `church_locations` e são reutilizados por eventos/cultos.
- O provider de push é uma interface vazia nesta etapa. Lembretes persistem antecedência e cancelamento, separados de presença.
- Os dados demonstrativos de Células existem apenas quando o app roda sem configuração Supabase e são identificados na interface. Quando há Supabase configurado, autenticação e RLS reais são obrigatórios.

## Pendências deliberadas

Conteúdo real, recuperação de senha, CRUD completo, uploads, calendário mensal interativo, comentários em tempo real, push, integrações sociais por API, processamento administrativo de exclusão, texto jurídico e builds de loja são etapas futuras. A rota estável `/privacidade` contém um placeholder explicitamente não jurídico.

## Fontes técnicas verificadas na criação

Foram conferidos o changelog atual do Supabase (incluindo Node 22+, exposição opt-in da Data API e bloqueio do schema Realtime), a documentação de RLS, Auth SSR/PKCE e Storage. A configuração segue grants explícitos, RLS por operação, `owner_id` e ausência de secrets no cliente.
