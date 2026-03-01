// Core client
export { TaprailClient } from './client';

// NFC
export { TaprailNFC } from './nfc';

// Provider & hooks
export { TaprailProvider } from './provider';
export type { TaprailProviderProps } from './provider';
export { useTaprail, useSession, useTransactions, useNFCPayment } from './hooks';
export type { UseSessionReturn, UseTransactionsReturn, UseNFCPaymentReturn } from './hooks';

// Components
export { PaymentSheet } from './components';

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
  NfcState,
  CardData,
  NfcPaymentResult,
  NfcPaymentParams,
  PaymentSheetProps,
} from './types';

export { TaprailError } from './types/errors';
