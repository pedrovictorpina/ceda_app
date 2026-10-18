# Menu mobile em tela cheia

A versão 0.2.3 substitui o painel inferior por um modal Nuxt UI que ocupa a área disponível do aplicativo. O objetivo é localizar uma área, tocar no atalho e voltar à tarefa sem barras de rolagem horizontais ou rótulos cortados.

- Cabeçalho com título e botão de fechar; a busca permanece acessível durante a rolagem.
- Grade de três colunas para atalhos e resultados da busca, com ícones e textos que podem quebrar linha.
- Todos os destinos da barra inferior também aparecem no menu. Uma seção de conta reúne perfil, notificações e privacidade.
- Recentes usa uma linha de até três destinos, exclui a página atual e aparece a partir de dois atalhos úteis.
- Administração e saída ficam em linhas separadas no rodapé. A troca de visão continua disponível somente aos perfis autorizados.
- Só a navegação interna rola. O cabeçalho e o rodapé respeitam as áreas seguras do aparelho; abrir o menu não foca a busca automaticamente, evitando abrir o teclado sem solicitação.
- Escape, botão de fechar, foco dentro do modal e retorno ao acionador usam o comportamento do Nuxt UI/Reka. Ao limpar a busca, o foco volta ao campo.

Sugestões para uma próxima etapa: permitir fixar até três favoritos pessoais e avaliar atalhos diretos para os horários dos cultos e para o mapa da igreja. São possibilidades de produto; não foram adicionados controles ou persistência de favoritos nesta entrega.

## Verificação

Lint, typecheck, build e 295 testes unitários passaram. No Chrome com toque simulado, o menu compilado foi conferido em 320×568, 390×844, 412×915 e 667×375 px, nos temas claro e escuro e com os perfis membro, caixa e administrador. Foram verificados: cobertura da tela, três colunas, ausência de overflow horizontal, rolagem interna, busca com e sem resultados, recentes, foco ao limpar/fechar, Escape, navegação e troca de visão autorizada. A altura reduzida de 430 px simulou a área disponível com teclado. Os cenários usaram API simulada, não fizeram gravações de negócio e terminaram sem erros ou avisos de console. A revisão por outro agente não identificou bloqueios. O APK não foi homologado em aparelho físico nesta etapa.
