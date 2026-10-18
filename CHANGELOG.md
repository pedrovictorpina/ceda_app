# Changelog

## Não publicado

- Endereço oficial da igreja atualizado nas páginas de visita e nos links de localização do mapa.
- A sessão salva é verificada na entrada do site e do aplicativo, com uma tela de carregamento até o perfil e o destino estarem prontos, sem exigir navegação adicional.
- Falhas de verificação mantêm as informações públicas acessíveis e oferecem uma nova tentativa; os fluxos de recuperação de senha continuam independentes.
- O fundo de seleção, hover e foco dos menus acompanha o formato arredondado de cada botão.

## 0.2.1 — 2026-10-18

- Corrigido o espaçamento do ícone no cartão do próximo culto: agora ele aparece em uma linha própria abaixo do selo, no celular e no desktop.

## 0.2.0 — 2026-10-18

- Padronização da interface com Nuxt UI, contraste acessível, controles móveis maiores, busca de navegação e data digitável.
- Recuperação de senha, confirmação de cadastro e retorno à tarefa após autenticar, com mensagens em português.
- Agenda e publicações consultam os registros reais; calendário mensal, filtros, preferências de aviso e exportação para calendário.
- Participação em grupos, mensagens salvas, publicações, curtidas e comentários persistidos por conta.
- Carrinho recuperável durante a sessão, proteção de rascunhos e confirmações para permissões elevadas e entrega de pedidos.
- Estados de erro e carregamento explícitos e proteção contra respostas antigas após trocar de conta.
- Migração `20261018194729_usability_member_actions`: lista privada de mensagens salvas, regras de acesso para interações e leitura pública restrita dos cultos.

Validação: lint, typecheck e build aprovados; 251 testes unitários; 33 assertivas SQL em PostgreSQL isolado; 36 verificações responsivas de páginas públicas. Recuperação por e-mail, dados da recepção, fluxos autenticados completos e experiência em aparelho físico exigem homologação no ambiente apropriado.
