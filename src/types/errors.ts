export type TaprailErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'INTERNAL'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'TIER_MISMATCH';

export class TaprailError extends Error {
  public readonly code: TaprailErrorCode;
  public readonly statusCode: number | null;
  public readonly rawMessage: string;

  constructor(code: TaprailErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'TaprailError';
    this.code = code;
    this.statusCode = statusCode ?? null;
    this.rawMessage = message;
  }
}
