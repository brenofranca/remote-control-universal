import { decodePoloMessage, encodeConfiguration, encodeOptions, encodePairingRequest, encodeSecret } from './polo';
import { concatBytes, lengthDelimitedField, varintField } from './wire';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text).map((char) => char.charCodeAt(0));
const HEADER = [0x08, 0x02, 0x10, 0xc8, 0x01];

describe('encode (cliente para TV)', () => {
  it('PairingRequest com service_name atvremote', () => {
    const expected = [...HEADER, 0x52, 0x0f, 0x0a, 0x09, ...ascii('atvremote'), 0x12, 0x02, ...ascii('ab')];
    expect(Array.from(encodePairingRequest('ab'))).toEqual(expected);
  });

  it('Options: encoding hexadecimal de 6 símbolos e papel INPUT', () => {
    const expected = [...HEADER, 0xa2, 0x01, 0x08, 0x0a, 0x04, 0x08, 0x03, 0x10, 0x06, 0x18, 0x01];
    expect(Array.from(encodeOptions())).toEqual(expected);
  });

  it('Configuration: encoding hexadecimal de 6 símbolos e client_role INPUT', () => {
    const expected = [...HEADER, 0xf2, 0x01, 0x08, 0x0a, 0x04, 0x08, 0x03, 0x10, 0x06, 0x10, 0x01];
    expect(Array.from(encodeConfiguration())).toEqual(expected);
  });

  it('Secret carrega os bytes do segredo', () => {
    const expected = [...HEADER, 0xc2, 0x02, 0x04, 0x0a, 0x02, 0xaa, 0xbb];
    expect(Array.from(encodeSecret(bytes(0xaa, 0xbb)))).toEqual(expected);
  });
});

describe('decodePoloMessage (TV para cliente)', () => {
  const outer = (status: number, ...fields: Uint8Array[]) =>
    concatBytes(varintField(1, 2), varintField(2, status), ...fields);

  it.each([
    ['pairingRequestAck', 11],
    ['options', 20],
    ['configurationAck', 31],
    ['secretAck', 41],
  ])('reconhece %s', (kind, field) => {
    const message = outer(200, lengthDelimitedField(field, bytes()));
    expect(decodePoloMessage(message)).toEqual({ ok: true, value: { kind } });
  });

  it.each([400, 401, 402])('reporta status de erro %d como falha de pareamento', (status) => {
    const result = decodePoloMessage(outer(status));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PAIRING_FAILED');
  });

  it('falha em mensagem sem tipo conhecido', () => {
    const result = decodePoloMessage(outer(200));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROTOCOL_ERROR');
  });

  it('falha em mensagem sem status', () => {
    const result = decodePoloMessage(varintField(1, 2));
    expect(result.ok).toBe(false);
  });

  it('falha em bytes malformados sem lançar exceção', () => {
    expect(decodePoloMessage(bytes(0x12, 0x7f)).ok).toBe(false);
  });
});
