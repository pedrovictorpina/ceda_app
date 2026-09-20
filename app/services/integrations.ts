export interface SocialFeedAdapter { listPublished(limit?: number): Promise<unknown[]> }
export interface LiveStreamAdapter { getCurrent(): Promise<unknown | null> }
export type PushProvider = 'unconfigured' | 'fcm' | 'onesignal'

export interface PushDeliveryInput {
  userId: string
  notificationId: string
  title: string
  body: string
  deepLink?: string | null
  at?: string
}

// This contract is intentionally server-side only. It does not expose tokens,
// device identifiers or provider credentials to Nuxt's public runtime config.
export interface PushAdapter {
  deliver(input: PushDeliveryInput): Promise<void>
  schedule(input: PushDeliveryInput & { at: string }): Promise<void>
  cancel(notificationId: string): Promise<void>
}

export class UnconfiguredAdapterError extends Error {
  constructor(service: string) { super(`${service} ainda não foi configurado.`) }
}

export function createDisabledPushAdapter(): PushAdapter {
  const disabled = () => Promise.reject(new UnconfiguredAdapterError('Push externo'))
  return { deliver: disabled, schedule: disabled, cancel: disabled }
}
