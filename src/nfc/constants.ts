// Beam custom P2P AID
export const BEAM_P2P_AID = 'F0010203040506';

// Proximity Payment System Environment
export const PPSE_AID = '325041592E5359532E4444463031'; // 2PAY.SYS.DDF01

// Standard payment AIDs
export const PAYMENT_AIDS: Record<string, string> = {
  VISA: 'A0000000031010',
  MASTERCARD: 'A0000000041010',
  VERVE: 'A0000003710001',
  AFRIGO: 'A000000891010101',
  AMEX: 'A000000025010801',
  DISCOVER: 'A0000001523010',
  JCB: 'A0000000651010',
  UNIONPAY: 'A000000333010101',
};

// AID to brand name mapping
export const AID_BRANDS: Record<string, string> = {
  'A0000000031010': 'Visa',
  'A0000000041010': 'Mastercard',
  'A0000003710001': 'Verve',
  'A000000891010101': 'Afrigo',
  'A000000025010801': 'Amex',
  'A0000001523010': 'Discover',
  'A0000000651010': 'JCB',
  'A000000333010101': 'UnionPay',
};

// APDU class byte
export const CLA = 0x00;
export const CLA_GP = 0x80;

// APDU instruction bytes
export const INS_SELECT = 0xa4;
export const INS_READ_RECORD = 0xb2;
export const INS_GPO = 0xa8;

// Select by name (P1=04)
export const P1_SELECT_BY_NAME = 0x04;
// First or only occurrence (P2=00)
export const P2_FIRST_OCCURRENCE = 0x00;

// Status words
export const SW_OK = [0x90, 0x00];

// EMV TLV tags
export const TAG_AID = '4F';
export const TAG_LABEL = '50';
export const TAG_PAN = '5A';
export const TAG_TRACK2 = '57';
export const TAG_CARDHOLDER_NAME = '5F20';
export const TAG_EXPIRY = '5F24';
export const TAG_AFL = '94';
export const TAG_AIP = '82';
export const TAG_FCI_TEMPLATE = '6F';
export const TAG_DF_NAME = '84';
export const TAG_FCI_PROP = 'A5';
export const TAG_SFI_RECORD = '70';
export const TAG_PDOL = '9F38';
export const TAG_RESPONSE_FORMAT1 = '80';
export const TAG_RESPONSE_FORMAT2 = '77';
