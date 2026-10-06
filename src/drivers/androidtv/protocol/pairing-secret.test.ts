import { computePairingSecret } from './pairing-secret';
import { forgeSha256 as sha256 } from './sha256-forge';

const toHex = (data: Uint8Array) => Array.from(data, (byte) => byte.toString(16).padStart(2, '0')).join('');

// Vetor gerado com o algoritmo de referência (androidtvremote2/pairing.py) em Python.
const CLIENT_MODULUS_HEX = 'C3' + 'A5'.repeat(254) + 'B7';
const SERVER_MODULUS_HEX = 'D1' + '3C'.repeat(254) + '09';
const EXPONENT_HEX = '010001';
const VALID_CODE = 'C1ABCD';
const EXPECTED_SECRET = 'c1402e4e32104c6dee6e3326ce976eee7e59601c07068f2f8a47c0e8d7e05c52';

const params = (code: string) => ({
  clientModulusHex: CLIENT_MODULUS_HEX,
  clientExponentHex: EXPONENT_HEX,
  serverModulusHex: SERVER_MODULUS_HEX,
  serverExponentHex: EXPONENT_HEX,
  code,
  sha256,
});

describe('computePairingSecret', () => {
  it('reproduz o segredo do algoritmo de referência', () => {
    const result = computePairingSecret(params(VALID_CODE));
    expect(result.ok).toBe(true);
    if (result.ok) expect(toHex(result.value)).toBe(EXPECTED_SECRET);
  });

  it('aceita o código em minúsculas', () => {
    const result = computePairingSecret(params(VALID_CODE.toLowerCase()));
    expect(result.ok).toBe(true);
  });

  it('normaliza expoente sem zero à esquerda (10001 equivale a 010001)', () => {
    const result = computePairingSecret({ ...params(VALID_CODE), clientExponentHex: '10001', serverExponentHex: '10001' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(toHex(result.value)).toBe(EXPECTED_SECRET);
  });

  it('rejeita código cujo primeiro byte não confere com o hash (erro de digitação)', () => {
    const result = computePairingSecret(params('00ABCD'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PAIRING_FAILED');
  });

  it.each(['', 'C1ABC', 'C1ABCDE', 'C1ABCG', 'C1 ABC', 'ZZZZZZ'])('rejeita código inválido %j', (code) => {
    const result = computePairingSecret(params(code));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PAIRING_FAILED');
  });

  it('rejeita módulo ou expoente que não seja hexadecimal', () => {
    expect(computePairingSecret({ ...params(VALID_CODE), serverModulusHex: 'XYZ' }).ok).toBe(false);
    expect(computePairingSecret({ ...params(VALID_CODE), clientExponentHex: '' }).ok).toBe(false);
  });
});
