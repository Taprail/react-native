import type { CardData } from '../types/nfc';
import {
  CLA, CLA_GP,
  INS_SELECT, INS_READ_RECORD, INS_GPO,
  P1_SELECT_BY_NAME, P2_FIRST_OCCURRENCE,
  SW_OK,
  AID_BRANDS,
  TAG_PAN, TAG_TRACK2, TAG_CARDHOLDER_NAME, TAG_EXPIRY, TAG_AFL,
  TAG_RESPONSE_FORMAT1, TAG_RESPONSE_FORMAT2,
} from './constants';

// ============================================================================
// APDU Command Builders
// ============================================================================

export function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

export function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function buildSelectCommand(aidHex: string): number[] {
  const aidBytes = hexToBytes(aidHex);
  return [
    CLA,
    INS_SELECT,
    P1_SELECT_BY_NAME,
    P2_FIRST_OCCURRENCE,
    aidBytes.length,
    ...aidBytes,
    0x00, // Le: expect any length response
  ];
}

export function buildReadRecordCommand(sfi: number, record: number): number[] {
  return [
    CLA,
    INS_READ_RECORD,
    record,
    (sfi << 3) | 0x04, // P2: SFI in upper 5 bits, 0x04 = by record number
    0x00,
  ];
}

export function buildGPOCommand(pdolData?: number[]): number[] {
  const data = pdolData ?? [0x83, 0x00]; // Empty PDOL
  return [
    CLA_GP,
    INS_GPO,
    0x00,
    0x00,
    data.length,
    ...data,
    0x00,
  ];
}

// ============================================================================
// Response Parsing
// ============================================================================

export function isSuccess(response: number[]): boolean {
  if (response.length < 2) return false;
  return (
    response[response.length - 2] === SW_OK[0] &&
    response[response.length - 1] === SW_OK[1]
  );
}

export function getResponseData(response: number[]): number[] {
  if (response.length < 2) return [];
  return response.slice(0, response.length - 2);
}

// ============================================================================
// TLV Parser
// ============================================================================

export interface TLVEntry {
  tag: string;
  value: number[];
  children?: TLVEntry[];
}

export function parseTLV(data: number[]): TLVEntry[] {
  const entries: TLVEntry[] = [];
  let i = 0;

  while (i < data.length) {
    if (data[i] === 0x00 || data[i] === 0xff) {
      i++;
      continue;
    }

    // Parse tag
    let tag = data[i]!.toString(16).padStart(2, '0');
    const isConstructed = (data[i]! & 0x20) !== 0;
    const isMultiByte = (data[i]! & 0x1f) === 0x1f;
    i++;

    if (isMultiByte && i < data.length) {
      tag += data[i]!.toString(16).padStart(2, '0');
      i++;
      // Handle 3-byte tags
      if (i < data.length && (data[i - 1]! & 0x80) !== 0) {
        tag += data[i]!.toString(16).padStart(2, '0');
        i++;
      }
    }

    if (i >= data.length) break;

    // Parse length
    let length = data[i]!;
    i++;

    if (length === 0x81 && i < data.length) {
      length = data[i]!;
      i++;
    } else if (length === 0x82 && i + 1 < data.length) {
      length = (data[i]! << 8) | data[i + 1]!;
      i += 2;
    }

    if (i + length > data.length) break;

    const value = data.slice(i, i + length);
    i += length;

    const entry: TLVEntry = { tag: tag.toUpperCase(), value };

    if (isConstructed && value.length > 0) {
      entry.children = parseTLV(value);
    }

    entries.push(entry);
  }

  return entries;
}

export function findTag(entries: TLVEntry[], tag: string): number[] | null {
  const upperTag = tag.toUpperCase();
  for (const entry of entries) {
    if (entry.tag === upperTag) return entry.value;
    if (entry.children) {
      const found = findTag(entry.children, tag);
      if (found) return found;
    }
  }
  return null;
}

// ============================================================================
// EMV Card Data Extraction
// ============================================================================

export function extractCardData(entries: TLVEntry[], selectedAid?: string): Partial<CardData> {
  const result: Partial<CardData> = { type: 'emv' };

  // Try to detect brand from AID
  if (selectedAid) {
    result.aid = selectedAid;
    result.cardBrand = detectCardBrand(selectedAid);
  }

  // Extract PAN from tag 5A
  const panBytes = findTag(entries, TAG_PAN);
  if (panBytes) {
    const pan = bytesToHex(panBytes).replace(/F+$/i, '');
    if (luhnCheck(pan)) {
      result.pan = pan;
      result.panLast4 = pan.slice(-4);
    }
  }

  // Try Track 2 equivalent (tag 57) if no PAN found
  if (!result.pan) {
    const track2 = findTag(entries, TAG_TRACK2);
    if (track2) {
      const track2Hex = bytesToHex(track2);
      const separatorIdx = track2Hex.indexOf('D');
      if (separatorIdx > 0) {
        const pan = track2Hex.substring(0, separatorIdx).replace(/F+$/i, '');
        if (luhnCheck(pan)) {
          result.pan = pan;
          result.panLast4 = pan.slice(-4);
          // Expiry follows separator: YYMM
          const expiryStr = track2Hex.substring(separatorIdx + 1, separatorIdx + 5);
          if (expiryStr.length === 4) {
            result.expiryYear = expiryStr.substring(0, 2);
            result.expiryMonth = expiryStr.substring(2, 4);
          }
        }
      }
    }
  }

  // Extract expiry from tag 5F24 (YYMMDD)
  if (!result.expiryMonth) {
    const expiryBytes = findTag(entries, TAG_EXPIRY);
    if (expiryBytes && expiryBytes.length >= 2) {
      const expiryHex = bytesToHex(expiryBytes);
      result.expiryYear = expiryHex.substring(0, 2);
      result.expiryMonth = expiryHex.substring(2, 4);
    }
  }

  // Extract cardholder name from tag 5F20
  const nameBytes = findTag(entries, TAG_CARDHOLDER_NAME);
  if (nameBytes) {
    result.cardholderName = String.fromCharCode(...nameBytes).trim();
    if (result.cardholderName === '/' || result.cardholderName === '') {
      result.cardholderName = undefined;
    }
  }

  return result;
}

export function extractAFL(entries: TLVEntry[]): number[] | null {
  // GPO response can be Format 1 (tag 80) or Format 2 (tag 77)
  const format1 = findTag(entries, TAG_RESPONSE_FORMAT1);
  if (format1 && format1.length >= 4) {
    // Format 1: first 2 bytes are AIP, rest is AFL
    return format1.slice(2);
  }

  // Format 2: AFL is in tag 94
  return findTag(entries, TAG_AFL);
}

// ============================================================================
// Utilities
// ============================================================================

export function detectCardBrand(aidHex: string): string {
  const upper = aidHex.toUpperCase();
  if (AID_BRANDS[upper]) return AID_BRANDS[upper]!;
  // Prefix matching for partial AIDs
  if (upper.startsWith('A000000003')) return 'Visa';
  if (upper.startsWith('A000000004')) return 'Mastercard';
  if (upper.startsWith('A000000371')) return 'Verve';
  return 'Unknown';
}

export function luhnCheck(pan: string): boolean {
  const digits = pan.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function maskPan(pan: string): string {
  if (pan.length <= 8) return pan;
  return pan.slice(0, 4) + '*'.repeat(pan.length - 8) + pan.slice(-4);
}
