import { forgeSha256 } from './sha256-forge';

const toHex = (data: Uint8Array) => Array.from(data, (byte) => byte.toString(16).padStart(2, '0')).join('');

describe('forgeSha256', () => {
  it('reproduz o vetor SHA-256 de "abc"', () => {
    const input = new Uint8Array([0x61, 0x62, 0x63]);
    expect(toHex(forgeSha256(input))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hash de entrada vazia', () => {
    expect(toHex(forgeSha256(new Uint8Array(0)))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('trata bytes altos (>= 0x80) sem corromper o hash', () => {
    const input = new Uint8Array([0xff, 0x80, 0x00, 0xc3]);
    expect(toHex(forgeSha256(input))).toBe('524f32940184dd237b2aa203f6d9dc8d9e81fddddc892a6e27436dfd63b8637b');
  });

  it('processa entradas maiores que o chunk interno', () => {
    expect(forgeSha256(new Uint8Array(20000).fill(0xab))).toHaveLength(32);
  });
});
