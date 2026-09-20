# Progresso de desenvolvimento — CEDA

Atualizado em 20 de setembro de 2026.

## Em produção

- Autenticação via Supabase, com cadastro sem confirmação de e-mail.
- Áreas institucionais públicas: Sobre Nós, Fale Conosco, Horários de Culto e Política de Privacidade.
- Navegação lateral, saída da conta, alternância entre visão de membro e visão administrativa.
- Perfil com foto, remoção de foto e preferência de notificações.
- Equipe pastoral com imagens, links e modal de detalhes.
- Design system com controles reutilizáveis e scroll padronizado.
- Estrutura de células, comunidade, pedidos de oração e área Ovelhinhas.
- Painel administrativo inicial com indicadores, Pessoas e permissões e Conteúdo e avisos.
- Conteúdo editorial: rascunhos, publicação, agendamento por data futura, histórico e avisos internos para membros que optaram por recebê-los.
- Política de banco que impede a criação de notificações para perfis com notificações desativadas.

## Em andamento

| Frente | Objetivo | Situação |
| --- | --- | --- |
| Agenda e eventos | Gestão administrativa de eventos, responsáveis e lembretes. | Em desenvolvimento. |
| Gestão de cargos | Conceder e revogar administrador/pastor com endpoint seguro de servidor e atualização de `app_metadata`. | Em desenvolvimento. |
| Auditoria e push | Registrar ações administrativas e preparar integração de push sem credenciais expostas. | Em desenvolvimento. |

## Dependências externas

- Push externo para APK/web: escolher e configurar o provedor (por exemplo, Firebase Cloud Messaging ou OneSignal), com credenciais do projeto.
- Gestão de cargos: configurar uma credencial de servidor exclusiva, protegida nas variáveis do Vercel/Supabase; ela nunca deve ir para o navegador.

## Próxima validação

Após concluir as frentes em andamento, validar em produção os fluxos de membro e administrador, especialmente cadastro, alteração de cargo, publicação, notificação e agenda.
