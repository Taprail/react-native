export type WebhookEventType =
  | 'session.created'
  | 'session.verified'
  | 'session.paid'
  | 'session.expired'
  | 'session.cancelled'
  | 'charge.succeeded'
  | 'charge.failed';

export interface WebhookEvent<T = Record<string, unknown>> {
  id: string;
  type: WebhookEventType;
  created_at: string;
  data: T;
}
