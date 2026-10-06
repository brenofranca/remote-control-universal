import forge from 'node-forge';
import type { Sha256 } from './pairing-secret';

const BINARY_CHUNK_SIZE = 8192;

const toBinaryString = (data: Uint8Array): string => {
  let text = '';
  for (let offset = 0; offset < data.length; offset += BINARY_CHUNK_SIZE) {
    text += String.fromCharCode(...data.subarray(offset, offset + BINARY_CHUNK_SIZE));
  }
  return text;
};

export const forgeSha256: Sha256 = (data) => {
  const digest = forge.md.sha256.create().update(toBinaryString(data)).digest().getBytes();
  return Uint8Array.from(digest, (char) => char.charCodeAt(0));
};
