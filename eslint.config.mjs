// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Projeto nativo gerado pelo Capacitor (build do Gradle e web copiado).
  { ignores: ['android/**', 'ios/**', 'releases/**'] }
)
