// Core client
export { TaprailClient } from './client';

// Provider & hooks
export { TaprailProvider } from './provider';
export type { TaprailProviderProps } from './provider';
export { useTaprail, useSession, useTransactions } from './hooks';
export type { UseSessionReturn, UseTransactionsReturn } from './hooks';

// Crypto utilities
export { computeSessionSignature, verifyWebhookSignature } from './crypto';
export type { SignatureParams, WebhookVerifyOptions } from './crypto';

// Types
export type {
  TaprailConfig,
  TaprailTier,
  ApiResponse,
  PaginationParams,
  Session,
  SessionStatus,
  CreateSessionParams,
  VerifySessionParams,
  ChargeSessionParams,
  Transaction,
  TransactionStatus,
  TransactionListParams,
  TaprailErrorCode,
  WebhookEventType,
  WebhookEvent,
} from './types';

export { TaprailError } from './types/errors';
