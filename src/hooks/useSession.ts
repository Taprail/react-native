import { useState, useCallback } from 'react';
import { useTaprail } from './useTaprail';
import type {
  Session,
  CreateSessionParams,
  VerifySessionParams,
  ChargeSessionParams,
  Transaction,
} from '../types';
import { TaprailError } from '../types/errors';

export interface UseSessionReturn {
  session: Session | null;
  transaction: Transaction | null;
  loading: boolean;
  error: TaprailError | null;
  create: (params: CreateSessionParams) => Promise<Session>;
  fetch: (sessionId: string) => Promise<Session>;
  verify: (sessionId: string, params: VerifySessionParams) => Promise<Session>;
  complete: (sessionId: string) => Promise<void>;
  charge: (sessionId: string, params: ChargeSessionParams) => Promise<Transaction>;
  cancel: (sessionId: string) => Promise<void>;
  computeSignature: (
    session: Pick<Session, 'id' | 'amount' | 'nonce' | 'expires_at'>,
    businessId: string,
    webhookSecret: string,
  ) => Promise<string>;
  reset: () => void;
}

export function useSession(): UseSessionReturn {
  const { client } = useTaprail();
  const [session, setSession] = useState<Session | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TaprailError | null>(null);

  const wrap = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        const err =
          e instanceof TaprailError
            ? e
            : new TaprailError('INTERNAL', (e as Error).message);
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const create = useCallback(
    (params: CreateSessionParams) =>
      wrap(async () => {
        const s = await client.createSession(params);
        setSession(s);
        return s;
      }),
    [client, wrap],
  );

  const fetch = useCallback(
    (sessionId: string) =>
      wrap(async () => {
        const s = await client.getSession(sessionId);
        setSession(s);
        return s;
      }),
    [client, wrap],
  );

  const verify = useCallback(
    (sessionId: string, params: VerifySessionParams) =>
      wrap(async () => {
        const s = await client.verifySession(sessionId, params);
        setSession(s);
        return s;
      }),
    [client, wrap],
  );

  const complete = useCallback(
    (sessionId: string) =>
      wrap(async () => {
        await client.completeSession(sessionId);
        const s = await client.getSession(sessionId);
        setSession(s);
      }),
    [client, wrap],
  );

  const charge = useCallback(
    (sessionId: string, params: ChargeSessionParams) =>
      wrap(async () => {
        const txn = await client.chargeSession(sessionId, params);
        setTransaction(txn);
        try {
          const s = await client.getSession(sessionId);
          setSession(s);
        } catch {
          // Charge succeeded; session refresh is best-effort
        }
        return txn;
      }),
    [client, wrap],
  );

  const cancel = useCallback(
    (sessionId: string) =>
      wrap(async () => {
        await client.cancelSession(sessionId);
        const s = await client.getSession(sessionId);
        setSession(s);
      }),
    [client, wrap],
  );

  const computeSignature = useCallback(
    (
      sess: Pick<Session, 'id' | 'amount' | 'nonce' | 'expires_at'>,
      businessId: string,
      webhookSecret: string,
    ) => client.computeSignature(sess, businessId, webhookSecret),
    [client],
  );

  const reset = useCallback(() => {
    setSession(null);
    setTransaction(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    session,
    transaction,
    loading,
    error,
    create,
    fetch,
    verify,
    complete,
    charge,
    cancel,
    computeSignature,
    reset,
  };
}
