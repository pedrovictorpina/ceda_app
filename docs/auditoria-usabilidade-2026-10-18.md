# Avaliação de intuitividade e usabilidade — CEDA

> **Atualização de implementação:** veja [Melhorias de usabilidade — 18/10/2026](melhorias-usabilidade-2026-10-18.md) para as alterações de A01–A12, evidências de validação e pendências. O diagnóstico e a nota abaixo descrevem a avaliação anterior às correções e foram preservados como histórico.

Data: 18/10/2026. Ambiente: código local da branch `codex/nuxt-ui-project`, incluindo a padronização atual com Nuxt UI. Esta avaliação não altera funcionalidades nem publica mudanças.

## Parecer

A intuitividade está em nível intermediário: **aproximadamente 6/10 em uma avaliação heurística**. Essa nota expressa julgamento de especialista sobre os achados abaixo; não é resultado de pesquisa com usuários, taxa de sucesso ou média estatística.

A identidade visual e os componentes ajudam a reconhecer ações. A maior dificuldade é saber se uma tarefa realmente foi concluída, se a informação é atual e qual é o próximo passo quando algo impede o usuário de continuar. A padronização com Nuxt UI oferece uma boa base para corrigir esses problemas de forma compartilhada.

| Dimensão | Avaliação | Principal motivo |
| --- | --- | --- |
| Identidade e consistência visual | Boa | Marca preservada, componentes e padrões recorrentes |
| Orientação e descoberta de funções | Intermediária | Agrupamentos úteis; nomes próximos e mudança de contexto aumentam a aprendizagem |
| Clareza da linguagem | Intermediária | Bons rótulos de tarefa convivem com termos de implementação |
| Confiança na conclusão e na informação | Fraca | Algumas confirmações são temporárias; agenda e destaques usam fontes diferentes |
| Recuperação de acesso e de erros | Fraca | Falta recuperação de senha; algumas falhas parecem ausência de registros |
| Adaptação visual ao celular | Boa na amostra pública | Sem rolagem horizontal nas sete páginas verificadas a 320 px |
| Conforto de interação e acessibilidade | Intermediária | Rótulos e componentes ajudam; contraste e controles pequenos exigem atenção |
| Prevenção de enganos operacionais | Intermediária | Existem confirmações e restauração, mas a proteção varia por ação |
| Desempenho percebido e uso com conexão ruim | Inconclusiva | Exige medição e execução dos fluxos autenticados em condições reais |

## Método e limites

- Inventário das 37 rotas e revisão de sua estrutura, fontes de dados, navegação e componentes compartilhados. A abrangência por rota consta no final deste documento.
- Navegador real no ambiente local: início público, entrada, cadastro, horários, sobre, contato e privacidade. Verificação de adaptação a 320 px; inspeções adicionais a 390 px e 1440 px. A altura e a densidade de cada tela não foram equiparadas a um teste em aparelho físico.
- Cadastro verificado quanto a campos, mensagens de validação e calendário de nascimento, sem criar conta. A seleção de mês e ano existe no calendário.
- Caminho público de oração verificado até a exigência de entrada. Não foi realizada autenticação durante esta avaliação.
- Nas áreas de membros e administrativas, os achados de comportamento são baseados no código atual. Não foram criados pedidos, alteradas permissões, registradas crianças ou modificados dados de pessoas.
- Não foram medidos sucesso com usuários reais, desempenho em produção, entrega de notificações, uso offline, leitor de tela ou funcionamento de teclado virtual em aparelho físico. Também não foi realizada auditoria completa de conformidade WCAG.
- Não foi executada a suíte completa de E2E. As verificações anteriores da migração de componentes não substituem a homologação dos fluxos com dados reais.

As referências utilizadas foram as [heurísticas de usabilidade do Nielsen Norman Group](https://www.nngroup.com/articles/ten-usability-heuristics/), o [contraste mínimo de texto da W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) e as orientações da W3C sobre [alvos mínimos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) e [alvos ampliados](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html).

Evidência **Navegador** indica observação direta nesta avaliação. **Código** indica comportamento demonstrado pela implementação. O impacto sobre compreensão, esforço ou enganos é uma interpretação heurística e precisa ser confrontado com uso real.

## Prioridade 1 — corrigir primeiro

### A01. Há confirmações que não representam uma tarefa persistida

**Evidência: Código.**

| Ação | Resposta exibida | Implementação atual |
| --- | --- | --- |
| Demonstrar interesse em um grupo | “Interesse registrado” | Modifica somente um array da página |
| Pedir lembrete de evento | “Lembrete ativo” | Modifica somente um array da página |
| Salvar a palavra | “Salva” | Alterna somente um booleano da página |
| Curtir e comentar no feed | Contagem e comentário aparecem na tela | Estado local, sem gravação ou compartilhamento com outros membros |

Ao remontar a página, esses estados são reiniciados. O membro tem motivos para acreditar que a liderança recebeu sua solicitação, que receberá um aviso ou que encontrará um conteúdo depois. O código dessas ações não concretiza essas expectativas. O compartilhamento nativo do feed é uma ação separada e utiliza as APIs do navegador.

**Recomendação:** persistir cada ação com confirmação do resultado e recuperação após recarga. Para lembretes, definir explicitamente o canal e a entrega que existem. Enquanto uma ação estiver indisponível, a interface deve informar isso antes de oferecer uma confirmação de sucesso. Disponibilizar um destino reconhecível para conteúdos salvos.

**Aceite:** registrar interesse cria uma solicitação visível à gestão; salvar e comentar sobrevivem à navegação; um lembrete informado como ativo tem registro e mecanismo de entrega verificáveis.

Fontes: `app/pages/comunidade.vue:7`, `:14`, `:70`; `app/pages/eventos.vue:9`, `:62`, `:200`; `app/pages/palavra-do-dia.vue:7`, `:59`; `app/pages/feed.vue:5`, `:8`, `:11`; `app/pages/admin/pessoas.vue:204`.

### A02. A informação apresentada ao membro não acompanha necessariamente a publicação da gestão

**Evidência: Código; rótulo de próximo encontro também observado no Navegador.**

- A gestão grava eventos em `events`; a página de eventos e os próximos encontros do início importam um catálogo estático.
- A visão mensal gera encontros por regras locais de dias da semana. Ela não consulta os eventos administrativos; o filtro da lista não determina esses marcadores. Há um rótulo fixo “4 atividades”.
- O início público anuncia “Próximo encontro / Domingo”, e a tela de horários marca um serviço como próximo de forma fixa. A frase “derivados do calendário central” não corresponde à implementação de horários.
- A palavra do dia completa e as notícias consultam publicações, enquanto o destaque do início usa o catálogo local. Notícias e palavra também exibem conteúdo de reserva sem distinguir ausência de publicação de falha de consulta.
- Campanhas apresentam percentuais e quantidades fixos. O aviso de que são informativas é positivo; os números ainda carecem de origem e data de atualização reconhecíveis.

Isso pode fazer a mesma igreja parecer ter agendas ou mensagens diferentes conforme a tela aberta. É um problema de confiança e de planejamento da visita.

**Recomendação:** usar a mesma fonte para lista, mês, próximo encontro e destaques. Mostrar data completa e atualização quando relevantes; distinguir conteúdo indisponível, ausência de publicação e erro. Valores informativos devem ter origem e vigência claras.

**Aceite:** um evento publicado ou cancelado pela gestão aparece de forma coerente em todas as superfícies; mudar um filtro produz a mesma interpretação na lista e no mês; uma falha de rede não mostra silenciosamente uma agenda de reserva como agenda atual.

Fontes: `app/pages/admin/agenda.vue:179`, `:243`, `:250`; `app/pages/eventos.vue:2`, `:28`, `:58`, `:118`; `app/pages/inicio.vue:2`; `app/pages/index.vue:49`; `app/pages/horarios-de-culto.vue:5`, `:20`; `app/composables/usePublishedEditorial.ts:17`, `:31`; `app/pages/noticias/index.vue:9`; `app/data/contentCatalog.ts:103`.

### A03. Quem esquece a senha ou entra por um link perde continuidade

**Evidência: Navegador e Código.**

A entrada não oferece “Esqueci minha senha”; não foi localizado fluxo de redefinição na aplicação. Uma pessoa que esqueceu a senha fica sem uma saída autônoma clara. Erros da autenticação são exibidos pela mensagem original do serviço, sem tradução garantida ou orientação específica.

No navegador, “Pedir oração” em Contato leva a `/entrar`. O middleware não conserva o destino, e o sucesso da entrada sempre navega para `/inicio`. A pessoa precisa encontrar novamente a tarefa que iniciou. A segunda parte foi confirmada pelo código, sem realizar login.

**Recomendação:** recuperação de senha completa, mensagens compreensíveis e preservação de um destino interno válido após entrada. Explicar por que o acesso é necessário antes de interromper a tarefa.

**Aceite:** alguém chega por um link de oração, identifica a necessidade de conta, recupera o acesso e retorna à tarefa originalmente escolhida. Destinos de retorno devem ser restritos às rotas internas permitidas.

Fontes: `app/pages/entrar.vue:16`, `:20`, `:22`; `app/middleware/auth.ts:8`; `app/pages/contato.vue:9`.

### A04. Planejar uma primeira visita e falar com alguém ainda exige procurar fora do fluxo

**Evidência: Navegador e Código.**

“Fale Conosco” oferece cartões para horários, oração e grupos; os dois últimos exigem conta. No ambiente local avaliado, o endereço não está preenchido e aparece um texto para buscar a localização nos canais da igreja. Não há um canal direto de recepção, telefone ou e-mail nessa página. Instagram e YouTube são alternativas externas, com esforço adicional para encontrar atendimento.

O caminho “Planejar uma visita” leva a horários e orientações úteis, mas não entrega sozinho endereço, rota e contato. O cabeçalho da página inicial oferece logo, tema e entrada; os demais caminhos institucionais dependem do conteúdo da página.

**Recomendação:** completar os dados oficiais no ambiente adequado e reunir próximo encontro com data, endereço, abertura do mapa e um contato real de recepção. Tornar “Sou visitante” ou uma ação equivalente fácil de reconhecer. Não inventar endereço, canal ou prazo de atendimento.

**Aceite:** uma pessoa sem cadastro encontra onde ir, quando ir e como esclarecer uma dúvida, sem precisar conhecer a organização interna do app. A configuração de produção deve ser verificada separadamente.

Fontes: `app/pages/contato.vue:7`, `:63`; `app/pages/horarios-de-culto.vue`; `app/pages/index.vue:40`; `app/layouts/public.vue`.

### A05. O contraste do botão principal no tema claro é insuficiente

**Evidência: Navegador, medição de estilos computados.**

Na entrada, a 390 × 844 px, o botão “Entrar” habilitado e o link de entrada do cabeçalho usam texto `#FFFFFF` sobre fundo `#FF6900`, fonte 14 px, peso 600. A razão de contraste calculada pela luminância relativa sRGB é **aproximadamente 2,89:1**. Para esse tamanho de texto, a referência AA é **4,5:1**. A medição utiliza as cores computadas do navegador, não pixels suavizados de uma captura.

Esse achado afeta uma combinação compartilhada da identidade visual e pode dificultar a leitura, especialmente para pessoas com baixa visão. Ele não constitui uma auditoria completa de todos os estados e temas.

**Recomendação:** ajustar o par de cores dos componentes compartilhados preservando a identidade; verificar texto, ícones, foco e estados em ambos os temas.

**Aceite:** os pares efetivamente usados nos controles de texto normal atendem a pelo menos 4,5:1. Referência: [W3C — contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Fontes: `/entrar` no navegador; `app/app.config.ts:4` e estilos resultantes do tema.

## Prioridade 2 — reduzir esforço e enganos

### A06. O tamanho dos controles varia entre os fluxos de celular

**Evidência: Navegador e Código.** Na entrada a 390 px, campos e botão principal têm 32 px de altura; o controle de mostrar senha mede 24 × 24 px. Fluxos como formulários de crianças e células já usam ações maiores.

**Impacto provável:** maior precisão exigida ao tocar, especialmente com uma mão e para pessoas com dificuldades motoras. Não se deve classificar todo alvo de 32 px como falha AA: o critério mínimo tem regras de espaçamento e exceções. O checkbox também possui rótulo acionável, portanto seu ícone de 16 px não representa sozinho toda a área de toque.

**Recomendação:** adotar 44–48 px como padrão de conforto para campos e ações principais no celular, com espaçamento proporcional. A referência de 44 px da W3C é ampliada, nível AAA; ela não é o mínimo AA.

Fontes: `/entrar` no navegador; `app/components/cells/CellsDetailsForm.vue`; `app/components/sementinhas/SementinhasChildForm.vue`.

### A07. A navegação exige aprender nomes e apresenta um contexto administrativo instável

**Evidência: Código.** Conteúdo e A Igreja agrupam páginas de forma útil; há busca e acessos recentes no menu móvel. Porém:

- “Células”, “Comunidade” e “Feed” são destinos próximos para quem pensa apenas “quero participar de um grupo”. A distinção depende de leitura e experiência.
- “Design System” faz parte do menu de membros no desktop, sem requisito de papel administrativo. É um destino técnico sem utilidade evidente para a maioria dos membros.
- O modo administrativo depende de a URL começar com `/admin` ou `/operacao`. O próprio menu administrativo aponta Sementinhas para `/sementinhas/turmas`; ao chegar ali, a expressão atual seleciona o menu de membro. A mudança de contexto pode parecer uma saída involuntária da gestão.
- A busca de navegação está no drawer móvel; não há equivalente na lateral de desktop.

**Recomendação:** preservar a separação de membro e administrador e explicitar o contexto de turmas. Usar descrições curtas orientadas a tarefas para grupos e participação; retirar ferramentas internas da navegação comum. Avaliar a necessidade de busca no desktop com usuários.

Fontes: `app/composables/useAppNavigation.ts:44`, `:58`, `:67`; `app/components/navigation/AppShell.vue:22`; `app/components/navigation/AppMenuSheet.vue:35`, `:43`.

### A08. Sair de uma tarefa pode perder trabalho em andamento

**Evidência: Código.** O carrinho e sua observação vivem no estado da página da loja. Sair da rota e remontá-la reinicia esse estado. Não foi encontrado guard de navegação para alterações pendentes nos formulários analisados. O editor de conteúdo permite fechar o modal sem uma confirmação específica de descarte.

**Recomendação:** preservar carrinho de maneira vinculada à sessão/conta e reconciliá-lo com o estoque ao retornar. Oferecer rascunho ou aviso de descarte nos formulários longos. A decisão sobre o que guardar deve respeitar a sensibilidade dos dados e a troca de usuário.

**Ponto positivo a manter:** limpar o carrinho já oferece “Desfazer”. A perda ao sair da rota é um problema diferente.

Fontes: `app/pages/loja.vue:22`, `:23`, `:110`; `app/pages/admin/conteudo.vue:442`, `:533`.

### A09. Falhas e listas vazias nem sempre têm significados distintos

**Evidência: Código.** A consulta inicial de oração usa apenas `data`, sem tratar `error` ou apresentar estado de carregamento próprio. A lista começa vazia, portanto a tela pode convidar a registrar o primeiro motivo durante a consulta ou após uma falha. A consulta editorial também descarta os erros. Notificações mostra mensagem original do serviço e não oferece ação explícita de tentar novamente.

**Recomendação:** padronizar carregando, vazio, erro e sucesso; oferecer próxima ação e preservar o conteúdo já conhecido. Uma consulta com falha não deve parecer ausência definitiva de registros. Nos formulários, validar junto ao campo: o título vazio de oração hoje apenas interrompe a função, sem explicar o motivo.

**Pontos positivos:** Loja, Células e Sementinhas já possuem tratamentos mais explícitos de atualização e erro que podem servir de referência compartilhada.

Fontes: `app/pages/oracao.vue:22`, `:71`, `:165`; `app/composables/usePublishedEditorial.ts:17`; `app/pages/notificacoes.vue:22`, `:33`; `app/pages/loja.vue:79`; `app/pages/sementinhas/index.vue:141`.

### A10. Alguns textos explicam a implementação e deixam a ação seguinte implícita

**Evidência: Código; cadastro também observado no Navegador.**

- Notificações usa “provedor de push futuro” e “não afirma envio externo”. O usuário precisa saber onde recebe avisos e como acompanhá-los.
- Perfil diz “A idade é sempre derivada da data de nascimento”. É uma regra interna apresentada como descrição principal da tela.
- O editor administrativo menciona “permissões do banco” e expõe endereço da publicação e data editorial sem explicar claramente sua utilidade.
- Cadastro fala em “solicitar acesso”, mas o resultado do código depende de confirmação de e-mail ou entrada imediata. A expressão pode sugerir uma aprovação manual que esse fluxo não demonstra.

**Recomendação:** escrever benefício, alcance e próximo passo em linguagem da igreja. Exemplos: “Atualize seus dados e escolha o que compartilhar”; “Os avisos aparecem nesta área”; “Confira seu e-mail para confirmar o cadastro”. Explicar recursos e limitações reais com palavras familiares.

Fontes: `app/pages/notificacoes.vue:60`, `:83`; `app/pages/perfil.vue:404`; `app/pages/admin/conteudo.vue:444`, `:496`; `app/pages/cadastro.vue:47`; `app/stores/auth.ts:115`.

### A11. A prevenção de enganos não acompanha sempre o impacto da ação

**Evidência: Código; impacto é hipótese de uso.** “Tornar admin”, “Tornar pastor” e suas remoções chamam diretamente a atualização de papéis. Na operação, “Entregar e dar baixa” conclui o pedido em um toque. Não há confirmação intermediária ou desfazer visível nesses pontos. As alterações não foram executadas nesta avaliação.

**Recomendação:** mostrar pessoa, papel e consequência antes de conceder/remover acesso elevado. Para entrega, verificar com a equipe a melhor proteção entre resumo, confirmação ou correção supervisionada; manter a velocidade necessária ao balcão. Não adicionar modais indiscriminadamente a todas as ações.

**Pontos positivos:** o cancelamento de pedido e o fechamento de caixa já pedem confirmação; estoque permite restauração e exclusão de conta exige escolha explícita. No estoque, “Arquivar” pode comunicar melhor a ação reversível hoje chamada de “Excluir”.

Fontes: `app/pages/admin/pessoas.vue:262`, `:587`, `:595`; `app/pages/operacao/index.vue:165`, `:343`, `:493`, `:527`; `app/pages/operacao/estoque.vue:633`, `:794`; `app/pages/perfil.vue:723`.

## Prioridade 3 — refinamentos e validações direcionadas

### A12. Reduzir descobertas ocultas e validar o teclado além dos componentes

**Evidência: Navegador e Código.** O calendário de nascimento permite escolher mês e depois ano pelo cabeçalho; não exige navegar mês a mês por décadas. Esse recurso, contudo, depende de descobrir a ação no título e não oferece digitação direta no wrapper atual. Avaliar entrada `dd/mm/aaaa` ou seleção explícita de ano para pessoas menos habituadas a calendários.

Em Sobre, os cartões de equipe têm `role="button"` e tratadores de Enter/Espaço, e contêm um link de Instagram. O clique do link tem interrupção de propagação; o evento de teclado pode alcançar o cartão e abrir seu modal. Esse risco foi identificado pelo código e precisa de reprodução focada. Preferir controles separados com foco e ações inequívocas.

Completar a avaliação com leitor de tela, teclado, ampliação de texto e ambos os temas. Os componentes Nuxt UI oferecem suporte de base; sua composição e os estilos precisam continuar sendo verificados.

Fontes: `app/components/AppDatePicker.vue:43`; `app/pages/sobre.vue:292`, `:295`, `:325`, `:343`.

## O que já funciona bem e deve orientar as correções

- Identidade da CEDA, títulos claros e padrões de formulário repetidos, agora apoiados em Nuxt UI.
- Cadastro com campos opcionais identificados, instrução de senha, erros junto aos campos e escolha explícita para felicitações de aniversário.
- Oração começa privada e explica as opções de compartilhamento. A escolha de privacidade é parte da tarefa.
- Células possui ações específicas de liderança, endereço, membros, avisos e enquetes, com componentes próprios; a apresentação separa responsabilidades.
- Sementinhas possui orientação de cadastro/check-in, estados de erro, atualização e distinção entre responsável e equipe infantil.
- Loja informa limites de estoque, ajusta quantidades com aviso e permite desfazer a limpeza do pedido. A operação explica o próximo passo e separa caixa e balcão.
- A galeria sem integração informa a situação e oferece canais reais, evitando uma coleção fictícia de fotos. O redirecionamento de Ovelhinhas preserva o acesso ao nome antigo.
- A navegação móvel oferece busca, recentes e abas por contexto. Há suporte a redução de movimento e adaptação dos elementos fixos enquanto se digita; o efeito em aparelho físico ainda precisa ser validado.

## Ordem de trabalho sugerida

1. **Restabelecer confiança:** resolver A01 e alinhar agenda/destaques em A02, com cenários de publicação e retorno à página.
2. **Destravar tarefas essenciais:** recuperar senha, preservar destino e completar o caminho do visitante, A03–A04.
3. **Ajustar os padrões compartilhados:** contraste, tamanhos, erros e textos, A05–A06 e A09–A10. Aplicar aos consumidores do mesmo componente.
4. **Preservar contexto e trabalho:** navegação e rascunhos/carrinho, A07–A08.
5. **Homologar com cada perfil:** prevenção operacional, teclado e refinamentos, A11–A12, em dados de teste controlados.

Essas etapas tratam causas compartilhadas. Não é necessário redesenhar cada tela para obter uma melhora substancial.

## Cobertura das 37 rotas

“Código” significa revisão da estrutura e dos pontos de interação, sem execução autenticada ou confirmação do resultado no servidor. As observações positivas sobre esses fluxos também têm esse limite.

| Rotas | Cobertura nesta avaliação | Foco e achados relacionados |
| --- | --- | --- |
| `/`, `/entrar`, `/cadastro` | Navegador e código | Primeira compreensão, entrada, cadastro, validação, contraste; A03–A06, A10, A12 |
| `/horarios-de-culto`, `/sobre`, `/contato` | Navegador e código | Visita, localização, próximos encontros e contato; A02, A04, A12 |
| `/privacidade` | Navegador e código | Acesso público e leitura responsiva; conteúdo jurídico não auditado |
| `/inicio`, `/palavra-do-dia`, `/mensagens/[id]` | Código | Destaques, leitura, origem e salvamento; A01–A02 |
| `/noticias`, `/noticias/[id]` | Código | Publicações e conteúdo de reserva; A02, A09 |
| `/galeria`, `/social` | Código | Destinos externos e estado sem integração; A07, A10 |
| `/eventos`, `/campanhas` | Código | Lista/mês, filtros, lembretes, vigência da informação; A01–A02 |
| `/comunidade`, `/feed` | Código | Participação e resultado das ações; A01, A07 |
| `/oracao`, `/aniversariantes` | Código | Privacidade, registro, descoberta e compartilhamento; A07, A09 |
| `/celulas`, `/celulas/[id]` | Código | Entrada e contexto de grupo, liderança, membros, formulários; A07–A09 |
| `/sementinhas`, `/sementinhas/turmas`, `/ovelhinhas` | Código | Responsável/equipe, contexto e compatibilidade de acesso; A06–A09 |
| `/loja`, `/operacao`, `/operacao/estoque`, `/operacao/relatorios` | Código | Pedido, estoque, caixa, entrega e leitura de resultados; A06, A08–A11 |
| `/perfil`, `/notificacoes` | Código | Dados pessoais, avisos, configurações e recuperação; A09–A10 |
| `/admin`, `/admin/pessoas`, `/admin/agenda`, `/admin/conteudo`, `/admin/auditoria` | Código | Gestão, publicação, permissões, contexto e rastreabilidade; A02, A07–A11 |
| `/design-system` | Código | Consistência compartilhada e exposição de ferramenta interna; A05–A07 |

## Próxima validação com pessoas

Após as correções prioritárias, realizar sessões curtas sem ensinar o caminho. Usar dados controlados para ações administrativas e operacionais.

| Perfil | Tarefa proposta | Evidência de compreensão e sucesso |
| --- | --- | --- |
| Visitante que nunca usou o app | Encontrar o próximo culto, localizar o endereço e falar com a recepção | Encontra informação atual e contato sem criar conta |
| Membro pouco familiarizado com tecnologia | Recuperar acesso, pedir oração privada e retornar ao pedido | Explica quem verá o pedido e consegue reencontrá-lo |
| Membro interessado em participar | Encontrar um grupo, solicitar participação, salvar uma mensagem e ativar lembrete | Entende o que acontecerá e encontra os resultados depois |
| Responsável por criança | Cadastrar uma criança, escolher turma e acompanhar um chamado | Reconhece estado atual e próxima ação sem auxílio |
| Líder/professor | Publicar aviso e administrar apenas seu contexto | Identifica público e consequência antes de confirmar |
| Caixa/balcão | Localizar pedido, confirmar pagamento e concluir entrega de teste | Distingue as etapas e corrige engano pelo procedimento previsto |
| Administrador | Publicar/cancelar evento e alterar permissão de teste | Reconhece alcance; o resultado aparece coerentemente na visão do membro |

Medir conclusão sem ajuda, abandonos, desvios, recuperação de erro e confiança declarada após cada tarefa. Separar resultados por perfil e experiência digital. Só então substituir a estimativa heurística por métricas observadas.
