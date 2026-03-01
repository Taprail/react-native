export type SessionStatus = 'pending' | 'locked' | 'paid' | 'expired' | 'cancelled';

export interface Session {
  id: string;
  merchant_ref: string | null;
  amount: number;
  currency: 'NGN';
  nonce: string;
  status: SessionStatus;
  signature: string;
  metadata: Record<string, unknown> | null;
  expires_at: string;
  created_at: string;
}

export interface CreateSessionParams {
  amount: number;
  merchant_ref?: string;
  metadata?: Record<string, unknown>;
}

export interface VerifySessionParams {
  nonce: string;
  signature: string;
}

export interface ChargeSessionParams {
  payment_token: string;
  email: string;
}
