# Nuxt UI no CEDA

Nuxt UI 4 é a biblioteca de componentes de todas as áreas: site público, acesso, membros, administração e operação da loja. O módulo, o CSS e o provider já estão configurados em `nuxt.config.ts`, `app/assets/css/main.css` e `app/app.vue`.

## Padrões compartilhados

| Necessidade | Componente |
| --- | --- |
| Ações e botões com destino | `UButton` |
| Links de texto e conteúdo | `ULink` |
| Navegação lateral, institucional e entre páginas de uma seção | `UNavigationMenu` |
| Abas de conteúdo na mesma página | `UTabs` |
| Formulário, rótulos e erros | `UForm`, `UFormField` |
| Texto, senha, data e arquivo | `UInput`, `UTextarea` |
| Escolha simples, múltipla e ativação | `USelect`, `URadioGroup`, `UCheckbox`, `USwitch` |
| Calendário e paginação | `UCalendar`, `UPagination` |
| Tabelas e conteúdo expansível | `UTable`, `UAccordion` |
| Confirmação e edição em sobreposição | `UModal`, `UDrawer`, `UPopover` |
| Cartões, avisos, status e carregamento | `UCard`, `UAlert`, `UBadge`, `USkeleton`, `UProgress`, `useToast` |

O tema fica em `app/app.config.ts`: laranja, neutros zinc e configurações compartilhadas de cada componente. Use `ui` e classes locais somente para a composição específica, como o menu inferior do celular, a quantidade da loja ou a grade de atalhos.

Os componentes de domínio continuam reutilizáveis: `NavigationAppShell`, `StoreQuantityStepper`, `CellsDetailsForm`, `SementinhasChildForm` e os demais compõem Nuxt UI com as regras de cada área. Não crie outra implementação de botão, campo, seletor, tabela ou modal.

`npm run lint` rejeita controles HTML diretos em `app/**/*.vue` quando existe equivalente acima. HTML semântico de estrutura, listas, imagens, gráficos SVG, Canvas das artes e a animação da logo continuam apropriados; não são substitutos de controles de interface.

## Cuidados de integração

- Passe o estado existente para `UForm` e mantenha a validação de domínio e os erros atuais. Formulários com validação própria conservam `novalidate`. Botões no rodapé de gavetas continuam apontando ao `id` do formulário pelo atributo `form`.
- `UInput type="file"` entrega o evento nativo em `change`. Ao abrir um campo por referência, use `inputRef`, por exemplo `avatarInput.value?.inputRef?.click()`. Preserve formatos aceitos, limites e `capture="environment"` onde já existe captura pela câmera.
- Destinos e permissões continuam em `useAppNavigation` e nos helpers existentes. Marque o item ativo usando a resolução de rotas do projeto e mantenha um nome acessível mesmo na barra lateral recolhida.
- Confirmações usam `UModal`: cancelar não executa a ação; durante o envio, bloquear fechamento e repetição. Mantenha autorização e persistência nos serviços existentes.
- Tabelas usam dados tipados e `TableColumn`, com legenda, alinhamento numérico e rolagem horizontal dentro do componente no celular.

## Verificação da migração

A revisão estática cobre todas as páginas e componentes. A conferência de navegador usa dados fictícios locais e Supabase desativado: navegação mobile e busca, barra lateral, cartões de loja/células/Sementinhas/aniversariantes, limites de quantidade, seleção de período pelo teclado, tabela expansível, validação do cadastro infantil e cancelamento da remoção de membro. Foram conferidos layouts de 320, 768, 1024 e 1440 px e temas claro/escuro. Essa conferência não equivale à homologação de sessões reais nem de um aparelho Capacitor.

Execute `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` ao alterar esses padrões. Pare a prévia antes de compilar para evitar disputa pelos artefatos de `.nuxt`.
