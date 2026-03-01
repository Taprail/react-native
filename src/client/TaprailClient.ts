import type {
  TaprailConfig,
  TaprailTier,
  Session,
  CreateSessionParams,
  VerifySessionParams,
  ChargeSessionParams,
  Transaction,
  TransactionListParams,
} from '../types';
import { TaprailError } from '../types/errors';
import { request } from './http';
import { computeSessionSignature } from '../crypto/hmac';

export class TaprailClient {
  private readonly config: TaprailConfig;

  constructor(config: TaprailConfig) {
    if (!config.apiKey) {
      throw new TaprailError('BAD_REQUEST', 'apiKey is required');
    }
    if (!config.tier || !['infra', 'platform'].includes(config.tier)) {
      throw new TaprailError('BAD_REQUEST', 'tier must be "infra" or "platform"');
    }
    this.config = {
      baseUrl: 'https://api.taprail.io',
      timeout: 15000,
      ...config,
    };
  }

  get tier(): TaprailTier {
    return this.config.tier;
  }

  // =========================================================================
  // Sessions
  // =========================================================================

  async createSession(params: CreateSessionParams): Promise<Session> {
    return request<Session>(this.config, {
      method: 'POST',
      path: '/sessions',
      body: params as unknown as Record<string, unknown>,
    });
  }

  async getSession(sessionId: string): Promise<Session> {
    return request<Session>(this.config, {
      method: 'GET',
      path: `/sessions/${sessionId}`,
    });
  }

  async verifySession(
    sessionId: string,
    params: VerifySessionParams,
  ): Promise<Session> {
    return request<Session>(this.config, {
      method: 'POST',
      path: `/sessions/${sessionId}/verify`,
      body: params as unknown as Record<string, unknown>,
    });
  }

  /** Complete a session (infra tier only). Marks session as paid. */
  async completeSession(sessionId: string): Promise<void> {
    this.assertTier('infra', 'completeSession');
    await request<null>(this.config, {
      method: 'POST',
      path: `/sessions/${sessionId}/complete`,
    });
  }

  /** Charge a session via Beam Switch (platform tier only). */
  async chargeSession(
    sessionId: string,
    params: ChargeSessionParams,
  ): Promise<Transaction> {
    this.assertTier('platform', 'chargeSession');
    return request<Transaction>(this.config, {
      method: 'POST',
      path: `/sessions/${sessionId}/charge`,
      body: params as unknown as Record<string, unknown>,
    });
  }

  /** Cancel a pending or locked session. */
  async cancelSession(sessionId: string): Promise<void> {
    await request<null>(this.config, {
      method: 'POST',
      path: `/sessions/${sessionId}/cancel`,
    });
  }

  // =========================================================================
  // Transactions
  // =========================================================================

  async listTransactions(
    params?: TransactionListParams,
  ): Promise<Transaction[]> {
    return request<Transaction[]>(this.config, {
      method: 'GET',
      path: '/transactions',
      params: params as unknown as Record<string, string | number | undefined>,
    });
  }

  /** Get a single transaction by ID (platform tier only). */
  async getTransaction(transactionId: string): Promise<Transaction> {
    this.assertTier('platform', 'getTransaction');
    return request<Transaction>(this.config, {
      method: 'GET',
      path: `/transactions/${transactionId}`,
    });
  }

  // =========================================================================
  // Signature helpers
  // =========================================================================

  async computeSignature(
    session: Pick<Session, 'id' | 'amount' | 'nonce' | 'expires_at'>,
    businessId: string,
    webhookSecret: string,
  ): Promise<string> {
    return computeSessionSignature({
      sessionId: session.id,
      businessId,
      amount: session.amount,
      nonce: session.nonce,
      expiresAt: session.expires_at,
      secret: webhookSecret,
    });
  }

  // =========================================================================
  // Internal
  // =========================================================================

  private assertTier(required: TaprailTier, method: string): void {
    if (this.config.tier !== required) {
      throw new TaprailError(
        'TIER_MISMATCH',
        `${method}() requires '${required}' tier, but client is configured for '${this.config.tier}'`,
      );
    }
  }
}
