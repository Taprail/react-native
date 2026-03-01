import type { PaginationParams } from './api';

export type TransactionStatus = 'success' | 'failed' | 'pending';

export interface Transaction {
  id: string;
  session_id: string | null;
  amount: number;
  fee: number;
  net_amount: number;
  currency: 'NGN';
  status: TransactionStatus;
  payment_reference: string | null;
  merchant_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TransactionListParams extends PaginationParams {
  status?: TransactionStatus;
  from?: string;
  to?: string;
}
