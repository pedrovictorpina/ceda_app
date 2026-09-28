# Progresso de desenvolvimento — CEDA

Atualizado em 20 de setembro de 2026.

## Em produção

- Autenticação via Supabase, com cadastro sem confirmação de e-mail.
- Áreas institucionais públicas: Sobre Nós, Fale Conosco, Horários de Culto e Política de Privacidade.
- Navegação lateral, saída da conta, alternância entre visão de membro e visão administrativa.
- Perfil com foto, remoção de foto e preferência de notificações.
- Equipe pastoral com imagens, links e modal de detalhes.
- Design system com controles reutilizáveis e scroll padronizado.
- Estrutura de células, comunidade, pedidos de oração e área infantil (agora chamada Sementinhas).
- Painel administrativo inicial com indicadores, Pessoas e permissões e Conteúdo e avisos.
- Conteúdo editorial: rascunhos, publicação, agendamento por data futura, histórico e avisos internos para membros que optaram por recebê-los.
- Política de banco que impede a criação de notificações para perfis com notificações desativadas.

## Em andamento

| Frente | Objetivo | Situação |
| --- | --- | --- |
| Agenda e eventos | Gestão administrativa de eventos, responsáveis e lembretes. | Em desenvolvimento. |
| Gestão de cargos | Conceder e revogar administrador/pastor com endpoint seguro de servidor e atualização de `app_metadata`. | Em desenvolvimento. |
| Auditoria e push | Registrar ações administrativas e preparar integração de push sem credenciais expostas. | Em desenvolvimento. |
| Aniversariantes | Data de nascimento e “Quero receber felicitações” no cadastro e no perfil; página `/aniversariantes` com filtros Hoje/Semana/Mês e exportação de imagem 16:9 ou Story. | Implementado no código; migration `20260929100000_profile_birthdays` aguarda aplicação no Supabase (aplicar antes do deploy). |
| Sementinhas | Renomear Ovelhinhas; responsáveis cadastram filhos (foto em bucket privado), fazem check-in/check-out e recebem chamados; professores (papel `teacher`) criam turmas por faixa de idade, adicionam crianças, acompanham a salinha e alertam os responsáveis. | Implementado no código; migrations `20260928120000`, `20260928120100` e `20260928120200` aguardam aplicação no Supabase. |
| Células: diretório e visitas | Diretório “Encontrar célula” para todos os membros, endereço com bairro e link para o Maps, perfil dos líderes (resumo, WhatsApp, Instagram), edição pela liderança, adição direta de membros e “Quero visitar essa célula” com notificação aos líderes. | Implementado no código; migrations `20260930120000_cells_directory_schema` e `20260930120100_cells_directory_rpcs` aguardam aplicação no Supabase (depois das pendentes de 28 e 29/09). |

## Dependências externas

- Push externo para APK/web: escolher e configurar o provedor (por exemplo, Firebase Cloud Messaging ou OneSignal), com credenciais do projeto.
- Gestão de cargos: configurar uma credencial de servidor exclusiva, protegida nas variáveis do Vercel/Supabase; ela nunca deve ir para o navegador.

## Próxima validação

Após concluir as frentes em andamento, validar em produção os fluxos de membro e administrador, especialmente cadastro, alteração de cargo, publicação, notificação e agenda.
