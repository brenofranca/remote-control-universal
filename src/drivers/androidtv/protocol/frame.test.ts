import { encodeFrame, FrameDecoder } from './frame';

const bytes = (...values: number[]) => new Uint8Array(values);

describe('encodeFrame', () => {
  it('prefixa o tamanho como varint', () => {
    expect(Array.from(encodeFrame(bytes(1, 2, 3)))).toEqual([3, 1, 2, 3]);
  });

  it('usa varint de 2 bytes para payload >= 128', () => {
    const frame = encodeFrame(new Uint8Array(200));
    expect(Array.from(frame.slice(0, 2))).toEqual([0xc8, 0x01]);
    expect(frame.length).toBe(202);
  });
});

describe('FrameDecoder', () => {
  it('entrega um frame completo', () => {
    const decoder = new FrameDecoder(1024);
    const result = decoder.push(bytes(3, 1, 2, 3));
    expect(result).toEqual({ ok: true, value: [bytes(1, 2, 3)] });
  });

  it('entrega vários frames em um único chunk', () => {
    const decoder = new FrameDecoder(1024);
    const result = decoder.push(bytes(1, 9, 2, 8, 7));
    expect(result).toEqual({ ok: true, value: [bytes(9), bytes(8, 7)] });
  });

  it('remonta frame dividido em chunks, inclusive no meio do varint', () => {
    const decoder = new FrameDecoder(1024);
    const frame = encodeFrame(new Uint8Array(200).fill(7));
    expect(decoder.push(frame.slice(0, 1))).toEqual({ ok: true, value: [] });
    expect(decoder.push(frame.slice(1, 50))).toEqual({ ok: true, value: [] });
    const last = decoder.push(frame.slice(50));
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.value[0]).toEqual(new Uint8Array(200).fill(7));
  });

  it('aceita frame vazio', () => {
    const decoder = new FrameDecoder(1024);
    expect(decoder.push(bytes(0))).toEqual({ ok: true, value: [new Uint8Array(0)] });
  });

  it('falha quando o tamanho declarado excede o máximo', () => {
    const decoder = new FrameDecoder(16);
    const result = decoder.push(bytes(17, 0));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROTOCOL_ERROR');
  });

  it('falha com varint de tamanho corrompido (mais de 5 bytes)', () => {
    const decoder = new FrameDecoder(1024);
    expect(decoder.push(bytes(0x80, 0x80, 0x80, 0x80, 0x80, 0x01)).ok).toBe(false);
  });

  it('permanece em falha após erro, pois o stream não ressincroniza', () => {
    const decoder = new FrameDecoder(4);
    decoder.push(bytes(9));
    expect(decoder.push(bytes(1, 1)).ok).toBe(false);
  });

  it('rejeita configuração inválida', () => {
    expect(() => new FrameDecoder(0)).toThrow(RangeError);
  });
});
