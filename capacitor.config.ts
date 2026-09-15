import type { CapacitorConfig } from '@capacitor/cli'

const productionWebUrl = process.env.CAPACITOR_SERVER_URL || 'https://ceda-app-beige.vercel.app'
const useBundledWebAssets = process.env.CAPACITOR_USE_BUNDLED_WEB === 'true'

const config: CapacitorConfig = {
  appId: 'org.example.ceda',
  appName: 'CEDA',
  webDir: '.output/public',
  server: useBundledWebAssets
    ? {
        androidScheme: 'https'
      }
    : {
        androidScheme: 'https',
        url: productionWebUrl
      }
}

export default config
