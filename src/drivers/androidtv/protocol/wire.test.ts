import { concatBytes, decodeVarint, encodeVarint, lengthDelimitedField, parseFields, varintField } from './wire';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('encodeVarint', () => {
  it.each([
    [0, [0x00]],
    [1, [0x01]],
    [127, [0x7f]],
    [128, [0x80, 0x01]],
    [200, [0xc8, 0x01]],
    [300, [0xac, 0x02]],
    [2 ** 32, [0x80, 0x80, 0x80, 0x80, 0x10]],
  ])('codifica %d', (value, expected) => {
    expect(Array.from(encodeVarint(value))).toEqual(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejeita %p', (value) => {
    expect(() => encodeVarint(value)).toThrow(RangeError);
  });
});

describe('decodeVarint', () => {
  it('decodifica a partir de um offset', () => {
    expect(decodeVarint(bytes(0xff, 0xc8, 0x01), 1)).toEqual({ ok: true, value: { value: 200, next: 3 } });
  });

  it('falha em varint truncado', () => {
    const result = decodeVarint(bytes(0x80), 0);
    expect(result.ok).toBe(false);
  });

  it('falha em varint maior que 8 bytes', () => {
    const result = decodeVarint(bytes(0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01), 0);
    expect(result.ok).toBe(false);
  });
});

describe('parseFields', () => {
  it('lê campos varint e length-delimited', () => {
    const payload = concatBytes(varintField(1, 300), lengthDelimitedField(2, bytes(0x61, 0x62)));
    const result = parseFields(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      { number: 1, wireType: 0, varint: 300 },
      { number: 2, wireType: 2, bytes: bytes(0x61, 0x62) },
    ]);
  });

  it('ignora campos fixed32 e fixed64 sem quebrar', () => {
    const payload = bytes(0x0d, 1, 2, 3, 4, 0x11, 1, 2, 3, 4, 5, 6, 7, 8, 0x18, 0x05);
    const result = parseFields(payload);
    expect(result).toEqual({ ok: true, value: [{ number: 3, wireType: 0, varint: 5 }] });
  });

  it('falha quando o tamanho declarado excede o buffer', () => {
    expect(parseFields(bytes(0x12, 0x05, 0x61)).ok).toBe(false);
  });

  it('falha com wire type de grupo', () => {
    expect(parseFields(bytes(0x0b)).ok).toBe(false);
  });

  it('falha com número de campo zero', () => {
    expect(parseFields(bytes(0x00, 0x01)).ok).toBe(false);
  });

  it('falha com tag truncada', () => {
    expect(parseFields(bytes(0x80)).ok).toBe(false);
  });

  it('aceita buffer vazio', () => {
    expect(parseFields(bytes())).toEqual({ ok: true, value: [] });
  });
});
