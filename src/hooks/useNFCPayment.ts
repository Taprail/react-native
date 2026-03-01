import { useState, useCallback, useRef } from 'react';
import { useTaprail } from './useTaprail';
import { TaprailNFC } from '../nfc/TaprailNFC';
import { computeSessionSignature } from '../crypto/hmac';
import type {
  Session,
  Transaction,
} from '../types';
import type {
  NfcState,
  CardData,
  NfcPaymentResult,
  NfcPaymentParams,
} from '../types/nfc';
import { TaprailError } from '../types/errors';

export interface UseNFCPaymentReturn {
  nfcState: NfcState;
  session: Session | null;
  transaction: Transaction | null;
  cardData: CardData | null;
  error: TaprailError | null;
  startPayment: (params: NfcPaymentParams) => Promise<NfcPaymentResult>;
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useNFCPayment(): UseNFCPaymentReturn {
  const { client } = useTaprail();
  const [nfcState, setNfcState] = useState<NfcState>('idle');
  const [session, setSession] = useState<Session | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [error, setError] = useState<TaprailError | null>(null);
  const nfcRef = useRef<TaprailNFC | null>(null);
  const cancelledRef = useRef(false);

  const startPayment = useCallback(
    async (params: NfcPaymentParams): Promise<NfcPaymentResult> => {
      cancelledRef.current = false;
      setError(null);
      setTransaction(null);
      setCardData(null);

      const nfc = new TaprailNFC();
      nfcRef.current = nfc;

      try {
        // Step 1: Create session
        setNfcState('ready');
        const newSession = await client.createSession({
          amount: params.amount,
          merchant_ref: params.merchantRef,
          metadata: params.metadata,
        });
        setSession(newSession);

        if (cancelledRef.current) throw new TaprailError('BAD_REQUEST', 'Payment cancelled');

        // Step 2: Wait for NFC tap
        setNfcState('detecting');
        const card = await nfc.readCard();
        setCardData(card);

        if (cancelledRef.current) throw new TaprailError('BAD_REQUEST', 'Payment cancelled');

        // Step 3: Verify session
        setNfcState('reading');
        const signature = await computeSessionSignature({
          sessionId: newSession.id,
          businessId: params.businessId,
          amount: newSession.amount,
          nonce: newSession.nonce,
          expiresAt: newSession.expires_at,
          secret: params.webhookSecret,
        });

        const verifiedSession = await client.verifySession(newSession.id, {
          nonce: newSession.nonce,
          signature,
        });
        setSession(verifiedSession);

        if (cancelledRef.current) throw new TaprailError('BAD_REQUEST', 'Payment cancelled');

        // Step 4: Complete or charge
        let txn: Transaction | null = null;

        if (client.tier === 'platform') {
          if (!params.email) {
            throw new TaprailError('BAD_REQUEST', 'email is required for platform tier');
          }
          txn = await client.chargeSession(newSession.id, {
            payment_token: card.rawPayload || card.pan || '',
            email: params.email,
          });
          setTransaction(txn);
        } else {
          await client.completeSession(newSession.id);
        }

        // Refresh session to get final status
        const finalSession = await client.getSession(newSession.id);
        setSession(finalSession);

        // Step 5: Success
        setNfcState('success');
        const result: NfcPaymentResult = {
          session: finalSession,
          transaction: txn,
          cardData: card,
        };
        return result;
      } catch (e) {
        const err =
          e instanceof TaprailError
            ? e
            : new TaprailError('INTERNAL', (e as Error).message);
        setError(err);
        setNfcState('error');
        throw err;
      } finally {
        await nfc.cleanup();
        nfcRef.current = null;
      }
    },
    [client],
  );

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    if (nfcRef.current) {
      await nfcRef.current.cleanup();
    }
    if (session && (session.status === 'pending' || session.status === 'locked')) {
      try {
        await client.cancelSession(session.id);
      } catch {
        // Best-effort cancel
      }
    }
    setNfcState('idle');
  }, [client, session]);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setNfcState('idle');
    setSession(null);
    setTransaction(null);
    setCardData(null);
    setError(null);
  }, []);

  return {
    nfcState,
    session,
    transaction,
    cardData,
    error,
    startPayment,
    cancel,
    reset,
  };
}
