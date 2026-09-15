export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@pinia/nuxt', '@vite-pwa/nuxt'],
  devtools: { enabled: true },
  app: {
    head: {
      titleTemplate: '%s · CEDA',
      meta: [
        { name: 'theme-color', content: '#f97316' },
        { name: 'description', content: 'Comunidade, agenda e cuidado em um só lugar.' }
      ]
    }
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || '',
      supabasePublishableKey: process.env.NUXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
      galleryUrl: process.env.NUXT_PUBLIC_GALLERY_URL || '',
      galleryProvider: process.env.NUXT_PUBLIC_GALLERY_PROVIDER || 'web',
      churchWebsiteUrl: process.env.NUXT_PUBLIC_CHURCH_WEBSITE_URL || '',
      instagramUrl: process.env.NUXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/igrejaceda/',
      youtubeUrl: process.env.NUXT_PUBLIC_YOUTUBE_URL || 'https://www.youtube.com/@IgrejaCEDA',
      churchAddress: process.env.NUXT_PUBLIC_CHURCH_ADDRESS || ''
    }
  },
  compatibilityDate: '2026-06-30',
  eslint: {
    config: {
      stylistic: { commaDangle: 'never', braceStyle: '1tbs' }
    }
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'CEDA',
      short_name: 'CEDA',
      description: 'Comunidade, agenda e cuidado da igreja.',
      theme_color: '#f97316',
      background_color: '#09090b',
      display: 'standalone',
      start_url: '/inicio',
      icons: [{ src: '/brand/ceda-logo.png', sizes: '1254x1254', type: 'image/png', purpose: 'any' }]
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,ico,jpg,jpeg,png,svg,woff2}']
    },
    devOptions: { enabled: false }
  }
})
