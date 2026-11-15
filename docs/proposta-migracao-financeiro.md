# Proposta de migração financeira da loja

## Objeto e impacto

Aplicar `supabase/migrations/20261114194836_store_financial_entries.sql` ao projeto CEDA de produção. O banco é compartilhado com o site publicado. A migração adiciona a tabela `store_financial_entries`, um índice por data, três políticas RLS e o gatilho `private.guard_store_financial_entry`. Não altera tabelas existentes, caixa, produtos, pedidos ou saldos; a criação da tabela e das políticas é uma mudança persistente de esquema visível também para o site.

Na inspeção de 14/11/2026, o histórico remoto continha a migração `20261114193113_counter_orders` e não continha esta migração financeira; a tabela e o gatilho financeiros também não existiam. O frontend publicado era o commit `50303589a2705f36ce27263bda05e6ef683a8af3`, que não consulta a nova tabela. A migração é aditiva e não exige mudança no frontend publicado, mas isso não substitui a validação após sua aplicação. O arquivo revisado tem SHA-256 `0B870252583A51B55949B7E8B10425C93E83E1F8F46962A3390EC79166E75720`; conferir novamente o hash antes da aprovação, pois pode mudar durante a revisão.

Os registros guardam data, tipo (saída ou doação), descrição ou nome, valor positivo, operador e instante de criação. Um lançamento pode ser estornado, com operador e instante; não pode ser alterado ou apagado pelo operador. Para corrigir, estornar e registrar outro. Um estorno não apaga histórico. A tabela é acessível apenas a operadores da loja autenticados; a função de checagem de papel existente unifica caixa e balcão. Não há permissão para `anon` nem `DELETE` para `authenticated`.

O frontend calcula o saldo do período como vendas confirmadas + doações − saídas. As vendas são agrupadas pela data da confirmação, no fuso de São Paulo; doações e saídas usam a data registrada. Não é saldo acumulado anterior. O custo de um lote de estoque não cria saída automaticamente, evitando duplicação. Cancelamentos de pedidos seguem as regras e o tratamento de receita existentes. Os arquivos exportados são CSV compatível com planilha e PNG; a imagem pede período menor caso exceda 250 linhas.

## Verificação feita

A migração revisada foi aplicada em uma instância PostgreSQL 18 isolada no worktree com papéis, perfis e funções de autenticação sintéticos. Passaram a criação e leitura por operador, valor e nome, recusa de alteração de valor, estorno com identidade, ausência de permissão de exclusão, bloqueio de leitura e inserção por membro e rejeição de valor zero e `NaN`. A instância foi encerrada após os testes. Os testes JavaScript validam agrupamento por data em São Paulo, soma em centavos e exclusão de estornos.

Na mesma inspeção de produção havia 10 pedidos entregues; todos tinham data de confirmação e dois não tinham forma de pagamento. O controle agrupa esses dois como pagamento não informado, sem inventar método. Esses números são um retrato pontual e não garantem que dados futuros tenham as mesmas características.

Essa simulação não substitui teste em Supabase de produção: usa substitutos das funções de autenticação e autorização e não executou a suíte pgTAP do projeto. A interface, o compartilhamento nativo de arquivos, concorrência, recuperação de falhas de rede e lançamentos reais ainda precisam de validação no ambiente autorizado após a migração. A exportação monetária depende de timestamps de confirmação já existentes; pedidos legados pagos sem `confirmed_at` não entram no controle por data.

## Aplicação, verificação e recuperação

1. Confirmar o projeto, as migrações já aplicadas, a disponibilidade de recuperação/backup e a ausência de operações conflitantes. A disponibilidade de backup não foi comprovada pelas ferramentas consultadas. Não fechar ou reconfigurar o caixa em preparação sem coordenação.
2. A pessoa autorizada deve aprovar a aplicação pela interface oficial de aprovação; aplicar uma única vez a migração revisada e alinhar seu número local ao histórico efetivo do Supabase. Não publicar o frontend nesta etapa.
3. Conferir tabela, RLS, grants, gatilho e advisors. Testar com operador protegido e dados identificáveis, anotando IDs; criar uma doação e uma saída pequenas, conferir filtros e exportações, e estorná-las após a conferência. Esses registros e seus estornos permanecem no histórico. Verificar que um membro não autorizado não consiga ler ou gravar.
4. Se houver falha de esquema antes de qualquer lançamento, interromper o uso e avaliar correção por migração posterior. Se já existirem lançamentos, não excluir tabela nem histórico: preferir uma correção compatível que preserve registros, auditoria e permissões, com revisão e backup. Reversão destrutiva exigiria decisão separada.

## Aprovação pendente

A tentativa de aplicação foi rejeitada duas vezes pela revisão automática. A segunda informou que não conseguia verificar diretamente, nesta tarefa, a autorização recebida por encaminhamento de outro chat. Não executar o SQL por outra ferramenta para contornar o bloqueio. A confirmação precisa ser fornecida diretamente nesta tarefa ou no formulário oficial de aprovação que a plataforma apresentar; a revisão automática ainda poderá exigir aprovação própria. Se a confirmação direta não produzir uma solicitação aprovável, o responsável pelo projeto precisará usar o fluxo administrativo oficial da plataforma para revisar a migração e coordenar sua aplicação.

## Câmera em iOS

O projeto ainda não contém a plataforma iOS gerada. Ao adicioná-la, incluir no `Info.plist` as descrições `NSCameraUsageDescription` e `NSPhotoLibraryUsageDescription`, além de `NSPhotoLibraryAddUsageDescription` se houver gravação na fototeca, conforme a documentação do plugin oficial `@capacitor/camera`. Validar autorização, recusa e retomada do app em iPhone antes de liberar essa plataforma.
