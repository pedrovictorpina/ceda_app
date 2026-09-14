export interface SocialFeedAdapter { listPublished(limit?: number): Promise<unknown[]> }
export interface LiveStreamAdapter { getCurrent(): Promise<unknown | null> }
export interface PushAdapter { schedule(input: { userId: string, notificationId: string, at: string }): Promise<void>, cancel(notificationId: string): Promise<void> }

export class UnconfiguredAdapterError extends Error {
  constructor(service: string) { super(`${service} ainda não foi configurado.`) }
}
