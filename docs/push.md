# Push externo

As notificações atuais da CEDA são internas: registros em `public.notifications`, respeitando `profiles.notifications_enabled`. Nenhum provedor externo recebe dados nesta etapa.

## Contrato preparado

`app/services/integrations.ts` define `PushAdapter` com `deliver`, `schedule` e `cancel`. A implementação padrão é `createDisabledPushAdapter()`: qualquer tentativa de entrega falha de modo explícito, sem realizar requisições de rede.

O seletor server-only `PUSH_PROVIDER` aceita `unconfigured` (padrão), `fcm` ou `onesignal`. Selecionar `fcm` ou `onesignal`, sozinho, **não ativa** envio. Isso evita uma configuração parcial ou a exposição acidental de credenciais no cliente.

## Antes de ativar

1. Escolher o provedor e criar as credenciais na conta institucional.
2. Implementar o adaptador em uma rota Nuxt server-side ou Supabase Edge Function; nunca no browser/WebView.
3. Guardar credenciais exclusivamente no cofre de segredos do ambiente de deploy. Não usar `NUXT_PUBLIC_*`, `.env.example`, Git ou `integration_settings` para tokens, chaves privadas ou IDs de dispositivo.
4. Registrar tokens de dispositivo em tabela própria com RLS por proprietário, rotação/revogação e consentimento explícito.
5. Usar o `notificationId` como chave de idempotência e registrar resultado de entrega sem salvar o conteúdo sensível do push.
6. Validar opt-in, opt-out e remoção de token antes de cada envio.

FCM e OneSignal exigem credenciais e contratos de dispositivo diferentes; por isso o repositório não inventa endpoints, IDs de aplicativo nem credenciais de nenhum provedor.
