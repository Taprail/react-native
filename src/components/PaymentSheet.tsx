import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import type { PaymentSheetProps } from '../types/nfc';
import { useNFCPayment } from '../hooks/useNFCPayment';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatCurrency(amount: number, currency = 'NGN'): string {
  const symbol = currency === 'NGN' ? '\u20A6' : currency;
  return `${symbol}${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export function PaymentSheet({
  amount,
  merchantName,
  currency = 'NGN',
  merchantRef,
  metadata,
  businessId,
  webhookSecret,
  email,
  visible,
  onComplete,
  onError,
  onDismiss,
  accentColor = '#000000',
  successColor = '#16a34a',
  errorColor = '#dc2626',
}: PaymentSheetProps) {
  const { nfcState, error, startPayment, cancel, reset } = useNFCPayment();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const hasStarted = useRef(false);

  // Start payment when sheet becomes visible
  useEffect(() => {
    if (visible && !hasStarted.current) {
      hasStarted.current = true;
      startPayment({
        amount,
        merchantRef,
        metadata,
        businessId,
        webhookSecret,
        email,
      })
        .then((result) => {
          onComplete(result);
        })
        .catch((err) => {
          onError?.(err);
        });
    }

    if (!visible) {
      hasStarted.current = false;
      reset();
    }
  }, [visible]);

  // Pulse animation for detecting state
  useEffect(() => {
    if (nfcState === 'detecting' || nfcState === 'ready') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [nfcState, pulseAnim]);

  // Shake animation for error state
  useEffect(() => {
    if (nfcState === 'error') {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [nfcState, shakeAnim]);

  // Scale-in animation for success
  useEffect(() => {
    if (nfcState === 'success') {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after 2 seconds
      const timer = setTimeout(() => {
        onDismiss?.();
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      scaleAnim.setValue(0);
    }
  }, [nfcState, scaleAnim, onDismiss]);

  const handleDismiss = useCallback(() => {
    cancel().then(() => onDismiss?.());
  }, [cancel, onDismiss]);

  const handleRetry = useCallback(() => {
    reset();
    hasStarted.current = false;
    // Re-trigger by toggling hasStarted
    setTimeout(() => {
      hasStarted.current = true;
      startPayment({
        amount,
        merchantRef,
        metadata,
        businessId,
        webhookSecret,
        email,
      })
        .then((result) => onComplete(result))
        .catch((err) => onError?.(err));
    }, 100);
  }, [startPayment, reset, amount, merchantRef, metadata, businessId, webhookSecret, email, onComplete, onError]);

  const stateConfig = getStateConfig(nfcState, error?.message);
  const iconColor =
    nfcState === 'success' ? successColor :
    nfcState === 'error' ? errorColor :
    accentColor;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Amount */}
          <Text style={styles.amount}>{formatCurrency(amount, currency)}</Text>
          {merchantName && (
            <Text style={styles.merchantName}>{merchantName}</Text>
          )}

          {/* Icon + Message */}
          <View style={styles.iconContainer}>
            {nfcState === 'success' ? (
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <View style={[styles.iconCircle, { borderColor: successColor }]}>
                  <Text style={[styles.iconText, { color: successColor }]}>✓</Text>
                </View>
              </Animated.View>
            ) : nfcState === 'error' ? (
              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <View style={[styles.iconCircle, { borderColor: errorColor }]}>
                  <Text style={[styles.iconText, { color: errorColor }]}>✕</Text>
                </View>
              </Animated.View>
            ) : (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={[styles.iconCircle, { borderColor: accentColor }]}>
                  <NfcIcon color={accentColor} />
                </View>
              </Animated.View>
            )}
          </View>

          <Text style={[
            styles.stateMessage,
            nfcState === 'error' && { color: errorColor },
            nfcState === 'success' && { color: successColor },
          ]}>
            {stateConfig.message}
          </Text>

          {nfcState === 'reading' && (
            <Text style={styles.subMessage}>Do not move the card</Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {nfcState === 'error' && (
              <TouchableOpacity style={[styles.button, styles.retryButton]} onPress={handleRetry}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}
            {nfcState !== 'success' && (
              <TouchableOpacity style={styles.button} onPress={handleDismiss}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Simple NFC contactless icon drawn with Text (no SVG dependency)
function NfcIcon({ color }: { color: string }) {
  return (
    <Text style={{ fontSize: 32, color, fontWeight: '300' }}>
      {/* Unicode contactless symbol */}
      {'\u00AB'}))
    </Text>
  );
}

function getStateConfig(state: string, errorMessage?: string) {
  switch (state) {
    case 'ready':
      return { message: 'Hold card near device' };
    case 'detecting':
      return { message: 'Searching for card...' };
    case 'reading':
      return { message: 'Processing payment...' };
    case 'success':
      return { message: 'Payment complete' };
    case 'error':
      return { message: errorMessage || 'Payment failed' };
    default:
      return { message: 'Preparing...' };
  }
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 360,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#09090b',
    fontVariant: ['tabular-nums'],
  },
  merchantName: {
    fontSize: 14,
    color: '#71717a',
    marginTop: 4,
  },
  iconContainer: {
    marginTop: 40,
    marginBottom: 24,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 40,
    fontWeight: '300',
  },
  stateMessage: {
    fontSize: 16,
    fontWeight: '500',
    color: '#09090b',
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 4,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    width: '100%',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#09090b',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#71717a',
    fontSize: 14,
    fontWeight: '500',
  },
});
