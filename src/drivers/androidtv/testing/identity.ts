import forge from 'node-forge';
import { buildClientIdentity } from '../certificate';
import type { ClientIdentity, RandomBytes } from '../ports';

const TEST_KEY_BITS = 1024;
const RSA_PUBLIC_EXPONENT = 0x10001;

export const insecureTestRandom: RandomBytes = (count) =>
  Uint8Array.from({ length: count }, () => Math.floor(Math.random() * 256));

// Apenas para testes: gera chave RSA em JS puro. Em produção a chave vem do módulo nativo.
export const generateTestPrivateKeyPem = (bits = TEST_KEY_BITS): string =>
  forge.pki.privateKeyToPem(forge.pki.rsa.generateKeyPair({ bits, e: RSA_PUBLIC_EXPONENT }).privateKey);

export const generateClientIdentityForTests = async (): Promise<ClientIdentity> => {
  const identity = buildClientIdentity(generateTestPrivateKeyPem(), insecureTestRandom, TEST_KEY_BITS);
  if (!identity.ok) throw new Error('falha ao montar identidade de teste');
  return identity.value;
};
