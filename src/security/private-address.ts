import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';

const OCTET_COUNT = 4;
const MAX_OCTET = 255;
const CANONICAL_OCTET = /^(0|[1-9]\d{0,2})$/;

const invalid = () => fail(domainError('INVALID_ADDRESS', 'Endereço de rede local inválido.'));

const parseOctets = (address: string): number[] | null => {
  const parts = address.split('.');
  if (parts.length !== OCTET_COUNT) return null;
  if (!parts.every((part) => CANONICAL_OCTET.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= MAX_OCTET) ? octets : null;
};

const isPrivateRange = ([first, second]: number[]): boolean =>
  first === 10 ||
  (first === 172 && second >= 16 && second <= 31) ||
  (first === 192 && second === 168) ||
  (first === 169 && second === 254);

export const parsePrivateIPv4 = (address: string): Result<string> => {
  if (typeof address !== 'string') return invalid();
  const octets = parseOctets(address);
  if (!octets || !isPrivateRange(octets)) return invalid();
  return ok(address);
};
