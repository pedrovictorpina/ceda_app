# Teste de edição de pedidos

Execute em um ambiente de teste após aplicar a migração e publicar o front.

1. Crie um pedido não pago. Edite-o, aumente e reduza quantidades, adicione e remova produtos. Confira o total e os saldos reservados.
2. Confirme o pagamento, edite novamente e confira que o total muda sem registrar cobrança ou devolução. Entregue o pedido e confira a baixa correta dos lotes.
3. Tente adicionar quantidade maior que o estoque, salvar o pedido vazio e editar simultaneamente em duas sessões. Confira que falhas não alteram o pedido nem o estoque.
4. Altere o preço de um produto já presente no pedido e confira que a edição mantém o preço original do item. Para um item novo, confira o preço atual.
5. Na edição de produto, digite um preço e confira a máscara com duas casas decimais. Repita os fluxos no celular e nos temas claro e escuro.
6. No estoque pelo celular, confira dois produtos por linha e toque na foto para ampliá-la. Feche a imagem e confira que a lista permanece acessível.
