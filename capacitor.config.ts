import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'org.example.ceda',
  appName: 'CEDA',
  webDir: '.output/public',
  server: { androidScheme: 'https' }
}

export default config
