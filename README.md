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
- A tabela `profiles` guarda dados pessoais; idade nunca é persistida, apenas derivada de `birth_date`.
- Papéis do sistema (`member`, `administrator`, `pastor`) são separados de tags/cargos e participações em ministérios.
- Políticas privilegiadas leem `app_metadata.roles`, nunca `user_metadata`. Ao alterar um papel, o backend administrativo futuro deve atualizar `app_metadata` com credencial exclusivamente server-side e revogar/renovar a sessão para evitar JWT desatualizado.
- As funções auxiliares são `SECURITY INVOKER`; não há `SECURITY DEFINER`.
- Middleware de rota melhora UX, mas não é fronteira de segurança. RLS é a proteção efetiva.
- Ovelhinhas exige aprovação de responsável e vínculo por criança; equipe infantil é separada. Crianças, alergias, emergência, vínculos e alertas não são públicos e têm trilha de auditoria.
- Solicitar exclusão cria um registro confirmado e auditável. Não apaga automaticamente a conta ou dados; o procedimento definitivo depende de política de retenção e revisão administrativa/jurídica.

### Storage e Realtime

Buckets privados previstos: `avatars`, `message-media`, `feed-media` e `child-private`. As policies restringem escrita por proprietário/gestor; mídia infantil começa limitada a administradores. Upsert de avatar tem SELECT/INSERT/UPDATE conforme exigido pelo Storage. Realtime está habilitado somente para mensagens, eventos, notificações e alertas infantis.

## Estrutura

```text
app/
  components/navigation/  shell web/mobile
  composables/             navegação e links oficiais
  layouts/                 público, membro e admin
  middleware/              autenticação, admin e Ovelhinhas
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

O manifest, service worker e tema inicial estão configurados. O ícone SVG é deliberadamente provisório; antes de homologar instalação, produza PNGs 192/512, ícone maskable, favicon e splash definitivos.

```bash
npx cap add android
npx cap add ios
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

`npm run mobile:sync` gera a versão estática e sincroniza `.output/public`. O `appId` atual (`org.example.ceda`) é placeholder obrigatório de troca antes de criar builds de loja. Não adicione plataformas nativas antes de confirmar:

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
- Site e Instagram são links oficiais simples configurados por env. A futura sincronização de feed usa contratos separados.
- Campanhas exibem meta e progresso informativos. Não há pagamento nem gateway.
- Contatos oficiais exigem consentimento registrado; contatos pessoais de membros não são publicados por padrão.
- Endereços oficiais ficam em `church_locations` e são reutilizados por eventos/cultos.
- O provider de push é uma interface vazia nesta etapa. Lembretes persistem antecedência e cancelamento, separados de presença.

## Pendências deliberadas

Conteúdo real, identidade visual definitiva, fluxo de cadastro/recuperação, CRUD completo, uploads, calendário mensal interativo, comentários em tempo real, push, integrações sociais, processamento administrativo de exclusão, texto jurídico e builds de loja são etapas futuras. A rota estável `/privacidade` contém um placeholder explicitamente não jurídico.

## Fontes técnicas verificadas na criação

Foram conferidos o changelog atual do Supabase (incluindo Node 22+, exposição opt-in da Data API e bloqueio do schema Realtime), a documentação de RLS, Auth SSR/PKCE e Storage. A configuração segue grants explícitos, RLS por operação, `owner_id` e ausência de secrets no cliente.
