/**
 * Abre o formulário de criação quando a página recebe `?novo=1` (atalhos do
 * painel administrativo) e limpa o parâmetro para que recarregar a página ou
 * voltar no histórico não reabra o formulário.
 */
export function useCreateFromQuery(openCreate: () => void) {
  const route = useRoute()
  const router = useRouter()

  onMounted(() => {
    if (route.query.novo !== '1') return
    openCreate()
    const { novo: _novo, ...query } = route.query
    void router.replace({ query })
  })
}
