import type { Session } from './session';
import type { Transaction } from './transaction';
import type { TaprailError } from './errors';

export type NfcState = 'idle' | 'ready' | 'detecting' | 'reading' | 'success' | 'error';

export interface CardData {
  /** Whether this was a Beam phone-to-phone tap or a physical EMV card. */
  type: 'beam_p2p' | 'emv';
  /** Beam P2P consumer ID (only for beam_p2p type). */
  consumerId?: string;
  /** Full card PAN (only available for infra tier processing). */
  pan?: string;
  /** Last 4 digits of the PAN. */
  panLast4?: string;
  /** Card expiry month (MM). */
  expiryMonth?: string;
  /** Card expiry year (YY). */
  expiryYear?: string;
  /** Cardholder name from the card. */
  cardholderName?: string;
  /** Selected AID hex string. */
  aid?: string;
  /** Detected card brand (Visa, Mastercard, Verve, etc.). */
  cardBrand?: string;
  /** Raw payload string used as payment_token in the charge step. */
  rawPayload?: string;
}

export interface NfcPaymentResult {
  session: Session;
  transaction: Transaction | null;
  cardData: CardData;
}

export interface NfcPaymentParams {
  amount: number;
  merchantRef?: string;
  metadata?: Record<string, unknown>;
  businessId: string;
  webhookSecret: string;
  /** Required for platform tier charge. */
  email?: string;
}

export interface PaymentSheetProps {
  /** Payment amount in NGN. */
  amount: number;
  /** Merchant display name shown on the sheet. */
  merchantName?: string;
  /** Currency display. Defaults to 'NGN'. */
  currency?: string;
  /** Merchant reference passed to session creation. */
  merchantRef?: string;
  /** Additional metadata for the session. */
  metadata?: Record<string, unknown>;
  /** Your business UUID for signature computation. */
  businessId: string;
  /** Your webhook secret for signature computation. */
  webhookSecret: string;
  /** Email for platform tier charge. */
  email?: string;
  /** Whether the sheet is visible. */
  visible: boolean;
  /** Called when payment completes successfully. */
  onComplete: (result: NfcPaymentResult) => void;
  /** Called on payment error. */
  onError?: (error: TaprailError) => void;
  /** Called when the sheet is dismissed. */
  onDismiss?: () => void;
  /** Primary accent color. Defaults to '#000000'. */
  accentColor?: string;
  /** Success state color. Defaults to '#16a34a'. */
  successColor?: string;
  /** Error state color. Defaults to '#dc2626'. */
  errorColor?: string;
}
