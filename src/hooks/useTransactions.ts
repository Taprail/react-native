import { useState, useCallback } from 'react';
import { useTaprail } from './useTaprail';
import type { Transaction, TransactionListParams } from '../types';
import { TaprailError } from '../types/errors';

export interface UseTransactionsReturn {
  transactions: Transaction[];
  transaction: Transaction | null;
  loading: boolean;
  error: TaprailError | null;
  hasMore: boolean;
  list: (params?: TransactionListParams) => Promise<Transaction[]>;
  loadMore: (params?: Omit<TransactionListParams, 'offset'>) => Promise<Transaction[]>;
  get: (transactionId: string) => Promise<Transaction>;
  reset: () => void;
}

export function useTransactions(): UseTransactionsReturn {
  const { client } = useTaprail();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<TaprailError | null>(null);
  const [hasMore, setHasMore] = useState(true);

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

  const list = useCallback(
    (params?: TransactionListParams) =>
      wrap(async () => {
        const limit = params?.limit ?? 50;
        const result = await client.listTransactions({ ...params, limit });
        setTransactions(result);
        setHasMore(result.length >= limit);
        return result;
      }),
    [client, wrap],
  );

  const loadMore = useCallback(
    (params?: Omit<TransactionListParams, 'offset'>) =>
      wrap(async () => {
        const limit = params?.limit ?? 50;
        const result = await client.listTransactions({
          ...params,
          limit,
          offset: transactions.length,
        });
        const combined = [...transactions, ...result];
        setTransactions(combined);
        setHasMore(result.length >= limit);
        return result;
      }),
    [client, transactions, wrap],
  );

  const get = useCallback(
    (transactionId: string) =>
      wrap(async () => {
        const txn = await client.getTransaction(transactionId);
        setTransaction(txn);
        return txn;
      }),
    [client, wrap],
  );

  const reset = useCallback(() => {
    setTransactions([]);
    setTransaction(null);
    setLoading(false);
    setError(null);
    setHasMore(true);
  }, []);

  return {
    transactions,
    transaction,
    loading,
    error,
    hasMore,
    list,
    loadMore,
    get,
    reset,
  };
}
