import forge from 'node-forge';
import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import type { ClientIdentity, PeerCertificate, RandomBytes } from './ports';

export const MIN_RSA_KEY_BITS = 2048;
const VALIDITY_YEARS = 10;
const CLIENT_COMMON_NAME = 'atvremote';
const SERIAL_BYTES = 8;
const POSITIVE_SERIAL_MASK = 0x7f;

const toBinaryString = (bytes: Uint8Array): string => Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');

const randomSerial = (random: RandomBytes): string => {
  const bytes = random(SERIAL_BYTES);
  if (bytes.length !== SERIAL_BYTES) throw new RangeError('Fonte de aleatoriedade devolveu quantidade incorreta de bytes.');
  bytes[0] &= POSITIVE_SERIAL_MASK;
  return forge.util.bytesToHex(toBinaryString(bytes));
};

const buildCertificate = (privateKey: forge.pki.rsa.PrivateKey, random: RandomBytes): forge.pki.Certificate => {
  const cert = forge.pki.createCertificate();
  const now = new Date();
  const name = [{ name: 'commonName', value: CLIENT_COMMON_NAME }];

  cert.publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);
  cert.serialNumber = randomSerial(random);
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(now.getFullYear() + VALIDITY_YEARS, now.getMonth(), now.getDate());
  cert.setSubject(name);
  cert.setIssuer(name);
  cert.setExtensions([{ name: 'basicConstraints', cA: true, pathLenConstraint: 0 }]);
  cert.sign(privateKey, forge.md.sha256.create());
  return cert;
};

/**
 * Monta o certificado autoassinado a partir de uma chave RSA já gerada.
 * A geração da chave é cara em JS puro, então fica com um gerador nativo (ver adapters/quick-crypto-rsa).
 */
export const buildClientIdentity = (
  privateKeyPem: string,
  random: RandomBytes,
  minKeyBits = MIN_RSA_KEY_BITS,
): Result<ClientIdentity> => {
  try {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey;
    if (privateKey.n.bitLength() < minKeyBits) return fail(domainError('PROTOCOL_ERROR', 'Chave RSA fraca demais.'));
    const cert = buildCertificate(privateKey, random);
    return ok({
      certificatePem: forge.pki.certificateToPem(cert),
      privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    });
  } catch {
    return fail(domainError('PROTOCOL_ERROR', 'Chave privada inválida.'));
  }
};

export interface IdentityGeneratorDependencies {
  readonly generatePrivateKeyPem: () => Promise<string>;
  readonly random: RandomBytes;
}

export const createIdentityGenerator =
  ({ generatePrivateKeyPem, random }: IdentityGeneratorDependencies) =>
  async (): Promise<ClientIdentity> => {
    const identity = buildClientIdentity(await generatePrivateKeyPem(), random);
    if (!identity.ok) throw new Error(identity.error.message);
    return identity.value;
  };

export const readPublicKeyHex = (certificatePem: string): Result<PeerCertificate> => {
  try {
    const publicKey = forge.pki.certificateFromPem(certificatePem).publicKey as forge.pki.rsa.PublicKey;
    return ok({ modulusHex: publicKey.n.toString(16), exponentHex: publicKey.e.toString(16) });
  } catch {
    return fail(domainError('PROTOCOL_ERROR', 'Certificado ilegível.'));
  }
};
