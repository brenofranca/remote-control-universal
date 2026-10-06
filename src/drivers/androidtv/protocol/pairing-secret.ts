import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { concatBytes } from './wire';

export type Sha256 = (data: Uint8Array) => Uint8Array;

export interface PairingSecretParams {
  readonly clientModulusHex: string;
  readonly clientExponentHex: string;
  readonly serverModulusHex: string;
  readonly serverExponentHex: string;
  readonly code: string;
  readonly sha256: Sha256;
}

const CODE_PATTERN = /^[0-9a-fA-F]{6}$/;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;
const CODE_CHECK_HEX_LENGTH = 2;
const HEX_RADIX = 16;
const BYTE_HEX_LENGTH = 2;

const pairingFailed = (message: string) => fail(domainError('PAIRING_FAILED', message));

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / BYTE_HEX_LENGTH);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = parseInt(hex.slice(index * BYTE_HEX_LENGTH, (index + 1) * BYTE_HEX_LENGTH), HEX_RADIX);
  }
  return bytes;
};

const normalizeHex = (hex: string): string | null => {
  if (!HEX_PATTERN.test(hex)) return null;
  const trimmed = hex.replace(/^0+/, '');
  if (trimmed === '') return null;
  return trimmed.length % 2 === 0 ? trimmed : `0${trimmed}`;
};

export const computePairingSecret = (params: PairingSecretParams): Result<Uint8Array> => {
  if (!CODE_PATTERN.test(params.code)) return pairingFailed('O código deve ter 6 caracteres hexadecimais.');

  const numbers = [
    params.clientModulusHex,
    params.clientExponentHex,
    params.serverModulusHex,
    params.serverExponentHex,
  ].map(normalizeHex);
  if (numbers.some((value) => value === null)) return pairingFailed('Certificado com chave pública inválida.');

  const codeCheck = parseInt(params.code.slice(0, CODE_CHECK_HEX_LENGTH), HEX_RADIX);
  const codeBody = params.code.slice(CODE_CHECK_HEX_LENGTH);
  const digest = params.sha256(concatBytes(...(numbers as string[]).map(hexToBytes), hexToBytes(codeBody)));

  if (digest[0] !== codeCheck) return pairingFailed('Código incorreto. Confira o que aparece na TV.');
  return ok(digest);
};
