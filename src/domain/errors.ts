export type ErrorCode =
  | 'INVALID_ADDRESS'
  | 'UNSUPPORTED_KEY'
  | 'NOT_CONNECTED'
  | 'CONNECTION_FAILED'
  | 'PAIRING_FAILED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PROTOCOL_ERROR'
  | 'UNTRUSTED_DEVICE';

export interface DomainError {
  readonly code: ErrorCode;
  readonly message: string;
}

export const domainError = (code: ErrorCode, message: string): DomainError => ({ code, message });
