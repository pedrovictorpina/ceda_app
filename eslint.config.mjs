// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Projeto nativo gerado pelo Capacitor (build do Gradle e web copiado).
  { ignores: ['android/**', 'ios/**', 'releases/**'] },
  {
    files: ['app/**/*.vue'],
    rules: {
      'vue/no-restricted-html-elements': ['error', {
        element: ['button', 'input', 'select', 'textarea', 'form', 'dialog', 'table', 'details', 'a'],
        message: 'Use o componente equivalente do Nuxt UI. Consulte docs/nuxt-ui.md.'
      }]
    }
  }
)
