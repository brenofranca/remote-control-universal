import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';

const VARINT_PAYLOAD_BITS = 7;
const VARINT_BASE = 2 ** VARINT_PAYLOAD_BITS;
const VARINT_CONTINUATION = 0x80;
const VARINT_PAYLOAD_MASK = 0x7f;
const MAX_VARINT_BYTES = 8;
const WIRE_TYPE_BITS = 3;
const WIRE_TYPE_MASK = 0b111;

export const WireType = { Varint: 0, Fixed64: 1, LengthDelimited: 2, Fixed32: 5 } as const;

export type WireField =
  | { readonly number: number; readonly wireType: 0; readonly varint: number }
  | { readonly number: number; readonly wireType: 2; readonly bytes: Uint8Array };

const protocolError = (message: string) => fail(domainError('PROTOCOL_ERROR', message));

export const concatBytes = (...parts: Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

export const encodeVarint = (value: number): Uint8Array => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('varint deve ser inteiro seguro não negativo');
  const out: number[] = [];
  let remaining = value;
  while (remaining >= VARINT_BASE) {
    out.push((remaining % VARINT_BASE) | VARINT_CONTINUATION);
    remaining = Math.floor(remaining / VARINT_BASE);
  }
  out.push(remaining);
  return new Uint8Array(out);
};

export const decodeVarint = (buffer: Uint8Array, offset: number): Result<{ value: number; next: number }> => {
  let value = 0;
  for (let index = 0; index < MAX_VARINT_BYTES; index++) {
    const position = offset + index;
    if (position >= buffer.length) return protocolError('Varint truncado.');
    const byte = buffer[position];
    value += (byte & VARINT_PAYLOAD_MASK) * VARINT_BASE ** index;
    if ((byte & VARINT_CONTINUATION) === 0) {
      return Number.isSafeInteger(value) ? ok({ value, next: position + 1 }) : protocolError('Varint fora do limite.');
    }
  }
  return protocolError('Varint longo demais.');
};

const tag = (field: number, wireType: number) => encodeVarint(field * 2 ** WIRE_TYPE_BITS + wireType);

export const varintField = (field: number, value: number): Uint8Array =>
  concatBytes(tag(field, WireType.Varint), encodeVarint(value));

export const lengthDelimitedField = (field: number, payload: Uint8Array): Uint8Array =>
  concatBytes(tag(field, WireType.LengthDelimited), encodeVarint(payload.length), payload);

export const stringField = (field: number, text: string): Uint8Array =>
  lengthDelimitedField(field, new TextEncoder().encode(text));

const FIXED_SIZES: Readonly<Record<number, number>> = { [WireType.Fixed64]: 8, [WireType.Fixed32]: 4 };

export const parseFields = (buffer: Uint8Array): Result<WireField[]> => {
  const fields: WireField[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const header = decodeVarint(buffer, offset);
    if (!header.ok) return header;
    const number = Math.floor(header.value.value / 2 ** WIRE_TYPE_BITS);
    const wireType = header.value.value & WIRE_TYPE_MASK;
    if (number < 1) return protocolError('Número de campo inválido.');
    offset = header.value.next;

    if (wireType === WireType.Varint) {
      const value = decodeVarint(buffer, offset);
      if (!value.ok) return value;
      fields.push({ number, wireType, varint: value.value.value });
      offset = value.value.next;
    } else if (wireType === WireType.LengthDelimited) {
      const length = decodeVarint(buffer, offset);
      if (!length.ok) return length;
      const start = length.value.next;
      const end = start + length.value.value;
      if (end > buffer.length) return protocolError('Campo excede o tamanho da mensagem.');
      fields.push({ number, wireType, bytes: buffer.slice(start, end) });
      offset = end;
    } else if (wireType in FIXED_SIZES) {
      offset += FIXED_SIZES[wireType];
      if (offset > buffer.length) return protocolError('Campo fixo truncado.');
    } else {
      return protocolError('Wire type não suportado.');
    }
  }
  return ok(fields);
};

export const findVarint = (fields: readonly WireField[], number: number): number | undefined => {
  const field = fields.find((candidate) => candidate.number === number && candidate.wireType === WireType.Varint);
  return field?.wireType === WireType.Varint ? field.varint : undefined;
};

export const findBytes = (fields: readonly WireField[], number: number): Uint8Array | undefined => {
  const field = fields.find((candidate) => candidate.number === number && candidate.wireType === WireType.LengthDelimited);
  return field?.wireType === WireType.LengthDelimited ? field.bytes : undefined;
};
