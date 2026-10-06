import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { concatBytes, encodeVarint } from './wire';

const VARINT_CONTINUATION = 0x80;
const VARINT_PAYLOAD_MASK = 0x7f;
const VARINT_PAYLOAD_BITS = 7;
const MAX_LENGTH_VARINT_BYTES = 5;

export const encodeFrame = (payload: Uint8Array): Uint8Array => concatBytes(encodeVarint(payload.length), payload);

type LengthPrefix = { readonly length: number; readonly headerSize: number } | 'incomplete' | 'invalid';

const readLengthPrefix = (buffer: Uint8Array): LengthPrefix => {
  let length = 0;
  for (let index = 0; index < MAX_LENGTH_VARINT_BYTES; index++) {
    if (index >= buffer.length) return 'incomplete';
    const byte = buffer[index];
    length += (byte & VARINT_PAYLOAD_MASK) * 2 ** (VARINT_PAYLOAD_BITS * index);
    if ((byte & VARINT_CONTINUATION) === 0) return { length, headerSize: index + 1 };
  }
  return 'invalid';
};

export class FrameDecoder {
  private buffer: Uint8Array = new Uint8Array(0);
  private failure: Result<never> | null = null;

  constructor(private readonly maxFrameSize: number) {
    if (maxFrameSize < 1) throw new RangeError('maxFrameSize deve ser >= 1');
  }

  push(chunk: Uint8Array): Result<Uint8Array[]> {
    if (this.failure) return this.failure;
    this.buffer = concatBytes(this.buffer, chunk);
    const frames: Uint8Array[] = [];

    while (this.buffer.length > 0) {
      const prefix = readLengthPrefix(this.buffer);
      if (prefix === 'incomplete') break;
      if (prefix === 'invalid') return this.abort('Tamanho de mensagem corrompido.');
      if (prefix.length > this.maxFrameSize) return this.abort('Mensagem maior que o limite permitido.');

      const end = prefix.headerSize + prefix.length;
      if (this.buffer.length < end) break;
      frames.push(this.buffer.slice(prefix.headerSize, end));
      this.buffer = this.buffer.slice(end);
    }
    return ok(frames);
  }

  private abort(message: string): Result<never> {
    this.buffer = new Uint8Array(0);
    this.failure = fail(domainError('PROTOCOL_ERROR', message));
    return this.failure;
  }
}
