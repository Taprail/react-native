import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import type { CardData } from '../types/nfc';
import { TaprailError } from '../types/errors';
import { BEAM_P2P_AID, PPSE_AID, PAYMENT_AIDS } from './constants';
import {
  buildSelectCommand,
  buildReadRecordCommand,
  buildGPOCommand,
  isSuccess,
  getResponseData,
  parseTLV,
  findTag,
  extractCardData,
  extractAFL,
  bytesToHex,
  hexToBytes,
} from './apdu';

export class TaprailNFC {
  private initialized = false;

  /** Check if the device has NFC hardware. */
  static async isSupported(): Promise<boolean> {
    try {
      return await NfcManager.isSupported();
    } catch {
      return false;
    }
  }

  /** Check if NFC is currently enabled on the device. */
  static async isEnabled(): Promise<boolean> {
    try {
      return await NfcManager.isEnabled();
    } catch {
      return false;
    }
  }

  /** Initialize NFC manager. Must be called before readCard(). */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      await NfcManager.start();
      this.initialized = true;
    } catch (e) {
      throw new TaprailError(
        'INTERNAL',
        `NFC initialization failed: ${(e as Error).message}`,
      );
    }
  }

  /** Clean up NFC resources. Call when done reading. */
  async cleanup(): Promise<void> {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Read a card or Beam device via NFC.
   *
   * Flow:
   * 1. Request ISO-DEP technology (waits for tap)
   * 2. Try Beam P2P handshake first
   * 3. Fall back to standard EMV card reading
   * 4. Return structured CardData
   */
  async readCard(): Promise<CardData> {
    await this.init();

    try {
      // Request ISO-DEP — this blocks until a card/device is tapped
      await NfcManager.requestTechnology(NfcTech.IsoDep);

      // Try Beam P2P first
      const beamResult = await this.tryBeamHandshake();
      if (beamResult) return beamResult;

      // Fall back to EMV
      return await this.readEMVCard();
    } catch (e) {
      if (e instanceof TaprailError) throw e;
      const msg = (e as Error).message || 'NFC read failed';
      if (msg.includes('cancelled') || msg.includes('cancel')) {
        throw new TaprailError('BAD_REQUEST', 'NFC scan cancelled');
      }
      throw new TaprailError('INTERNAL', `NFC read failed: ${msg}`);
    } finally {
      await this.cleanup();
    }
  }

  // ===========================================================================
  // Beam P2P Handshake
  // ===========================================================================

  private async tryBeamHandshake(): Promise<CardData | null> {
    try {
      const selectCmd = buildSelectCommand(BEAM_P2P_AID);
      const response = await this.transceive(selectCmd);

      if (!isSuccess(response)) return null;

      const data = getResponseData(response);
      if (data.length === 0) return null;

      // Parse Beam payload: "BEAM_P2P|{consumerId}|{timestamp}|{nonce}|{signature}"
      const payload = String.fromCharCode(...data);
      if (!payload.startsWith('BEAM_P2P|')) return null;

      const parts = payload.split('|');
      if (parts.length < 3) return null;

      return {
        type: 'beam_p2p',
        consumerId: parts[1],
        cardBrand: 'Beam',
        rawPayload: payload,
      };
    } catch {
      // Beam handshake failed — not a Beam device, try EMV
      return null;
    }
  }

  // ===========================================================================
  // EMV Card Reading
  // ===========================================================================

  private async readEMVCard(): Promise<CardData> {
    // Step 1: Discover AIDs via PPSE
    const discoveredAids = await this.selectPPSE();

    // Step 2: Try discovered AIDs first, then known AIDs
    const aidsToTry = [
      ...discoveredAids,
      ...Object.values(PAYMENT_AIDS),
    ];

    // Deduplicate
    const uniqueAids = [...new Set(aidsToTry.map((a) => a.toUpperCase()))];

    let selectedAid: string | null = null;
    for (const aid of uniqueAids) {
      if (await this.selectAID(aid)) {
        selectedAid = aid;
        break;
      }
    }

    if (!selectedAid) {
      throw new TaprailError('BAD_REQUEST', 'No supported payment application found on card');
    }

    // Step 3: Get Processing Options
    const gpoResponse = await this.runGPO();
    const gpoEntries = parseTLV(Array.from(gpoResponse));
    const afl = extractAFL(gpoEntries);

    // Step 4: Read records from AFL
    const allEntries = [...gpoEntries];
    if (afl && afl.length >= 4) {
      const recordEntries = await this.readRecords(afl);
      allEntries.push(...recordEntries);
    }

    // Step 5: Extract card data
    const cardData = extractCardData(allEntries, selectedAid);

    if (!cardData.pan && !cardData.panLast4) {
      throw new TaprailError('BAD_REQUEST', 'Could not read card data');
    }

    return {
      type: 'emv',
      ...cardData,
      rawPayload: cardData.pan || selectedAid,
    } as CardData;
  }

  private async selectPPSE(): Promise<string[]> {
    try {
      const cmd = buildSelectCommand(PPSE_AID);
      const response = await this.transceive(cmd);
      if (!isSuccess(response)) return [];

      const data = getResponseData(response);
      const entries = parseTLV(data);

      // Extract AIDs from directory entries (tag 4F)
      const aids: string[] = [];
      const aidValues = this.findAllTags(entries, '4F');
      for (const aidBytes of aidValues) {
        aids.push(bytesToHex(aidBytes));
      }

      return aids;
    } catch {
      return [];
    }
  }

  private async selectAID(aidHex: string): Promise<boolean> {
    try {
      const cmd = buildSelectCommand(aidHex);
      const response = await this.transceive(cmd);
      return isSuccess(response);
    } catch {
      return false;
    }
  }

  private async runGPO(): Promise<Uint8Array> {
    const cmd = buildGPOCommand();
    const response = await this.transceive(cmd);

    if (!isSuccess(response)) {
      throw new TaprailError('BAD_REQUEST', 'Card rejected Get Processing Options');
    }

    return new Uint8Array(getResponseData(response));
  }

  private async readRecords(afl: number[]): Promise<import('./apdu').TLVEntry[]> {
    const allEntries: import('./apdu').TLVEntry[] = [];

    // AFL is groups of 4 bytes: SFI(1) | firstRecord(1) | lastRecord(1) | offlineDataAuth(1)
    for (let i = 0; i + 3 < afl.length; i += 4) {
      const sfi = (afl[i]! >> 3) & 0x1f;
      const firstRecord = afl[i + 1]!;
      const lastRecord = afl[i + 2]!;

      for (let record = firstRecord; record <= lastRecord; record++) {
        try {
          const cmd = buildReadRecordCommand(sfi, record);
          const response = await this.transceive(cmd);
          if (isSuccess(response)) {
            const data = getResponseData(response);
            const entries = parseTLV(data);
            allEntries.push(...entries);
          }
        } catch {
          // Skip unreadable records
          continue;
        }
      }
    }

    return allEntries;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async transceive(command: number[]): Promise<number[]> {
    const handler = NfcManager.isoDepHandler;
    const response = await handler.transceive(command);
    return response;
  }

  private findAllTags(entries: import('./apdu').TLVEntry[], tag: string): number[][] {
    const results: number[][] = [];
    const upperTag = tag.toUpperCase();
    for (const entry of entries) {
      if (entry.tag === upperTag) results.push(entry.value);
      if (entry.children) {
        results.push(...this.findAllTags(entry.children, tag));
      }
    }
    return results;
  }
}
