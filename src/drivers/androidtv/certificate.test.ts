import forge from 'node-forge';
import { buildClientIdentity, createIdentityGenerator, MIN_RSA_KEY_BITS, readPublicKeyHex } from './certificate';
import type { ClientIdentity } from './ports';
import { generateTestPrivateKeyPem, insecureTestRandom } from './testing/identity';

const TEST_KEY_BITS = 1024;
const YEAR_MS = 365 * 24 * 3600 * 1000;

let privateKeyPem: string;
let identity: ClientIdentity;

beforeAll(() => {
  privateKeyPem = generateTestPrivateKeyPem(TEST_KEY_BITS);
  const built = buildClientIdentity(privateKeyPem, insecureTestRandom, TEST_KEY_BITS);
  if (!built.ok) throw new Error('falha ao montar identidade');
  identity = built.value;
});

describe('buildClientIdentity', () => {
  it('gera certificado autoassinado válido com o mesmo par de chaves', () => {
    const cert = forge.pki.certificateFromPem(identity.certificatePem);
    const publicKey = cert.publicKey as forge.pki.rsa.PublicKey;
    const privateKey = forge.pki.privateKeyFromPem(identity.privateKeyPem) as forge.pki.rsa.PrivateKey;

    expect(cert.verify(cert)).toBe(true);
    expect(publicKey.n.toString(16)).toBe(privateKey.n.toString(16));
    expect(publicKey.e.toString(16)).toBe('10001');
  });

  it('marca o certificado como CA com validade de cerca de 10 anos', () => {
    const cert = forge.pki.certificateFromPem(identity.certificatePem);
    const years = (cert.validity.notAfter.getTime() - cert.validity.notBefore.getTime()) / YEAR_MS;

    expect(cert.getExtension('basicConstraints')).toMatchObject({ cA: true });
    expect(years).toBeGreaterThan(9.9);
    expect(years).toBeLessThan(10.1);
  });

  it('a chave privada exportada assina e o certificado verifica', () => {
    const cert = forge.pki.certificateFromPem(identity.certificatePem);
    const privateKey = forge.pki.privateKeyFromPem(identity.privateKeyPem) as forge.pki.rsa.PrivateKey;
    const md = forge.md.sha256.create().update('teste');

    expect((cert.publicKey as forge.pki.rsa.PublicKey).verify(md.digest().getBytes(), privateKey.sign(md))).toBe(true);
  });

  it('exporta a chave privada em PKCS#1 (RSA PRIVATE KEY)', () => {
    expect(identity.privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
  });

  it('recusa chave menor que o mínimo de segurança', () => {
    const result = buildClientIdentity(privateKeyPem, insecureTestRandom);
    expect(TEST_KEY_BITS).toBeLessThan(MIN_RSA_KEY_BITS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROTOCOL_ERROR');
  });

  it('recusa PEM inválido sem lançar exceção', () => {
    expect(buildClientIdentity('lixo', insecureTestRandom, TEST_KEY_BITS).ok).toBe(false);
  });

  it('usa a fonte de aleatoriedade injetada para o serial', () => {
    const random = jest.fn(insecureTestRandom);
    buildClientIdentity(privateKeyPem, random, TEST_KEY_BITS);
    expect(random).toHaveBeenCalledWith(8);
  });

  it('serial é sempre positivo', () => {
    const allOnes = () => new Uint8Array(8).fill(0xff);
    const built = buildClientIdentity(privateKeyPem, allOnes, TEST_KEY_BITS);
    if (!built.ok) throw new Error('falha');
    const serial = forge.pki.certificateFromPem(built.value.certificatePem).serialNumber;
    expect(parseInt(serial.slice(0, 2), 16)).toBeLessThan(0x80);
  });

  it('falha se a fonte de aleatoriedade devolver quantidade errada de bytes', () => {
    expect(buildClientIdentity(privateKeyPem, () => new Uint8Array(1), TEST_KEY_BITS).ok).toBe(false);
  });
});

describe('createIdentityGenerator', () => {
  it('consulta o gerador de chave e recusa chave fraca vinda dele', async () => {
    const generatePrivateKeyPem = jest.fn(async () => privateKeyPem);
    const generate = createIdentityGenerator({ generatePrivateKeyPem, random: insecureTestRandom });

    await expect(generate()).rejects.toThrow('fraca demais');
    expect(generatePrivateKeyPem).toHaveBeenCalledTimes(1);
  });

  it('propaga falha do gerador de chave', async () => {
    const generate = createIdentityGenerator({
      generatePrivateKeyPem: async () => {
        throw new Error('módulo nativo indisponível');
      },
      random: insecureTestRandom,
    });
    await expect(generate()).rejects.toThrow('módulo nativo indisponível');
  });
});

describe('readPublicKeyHex', () => {
  it('extrai módulo e expoente do certificado PEM', () => {
    const key = readPublicKeyHex(identity.certificatePem);
    expect(key.ok).toBe(true);
    if (!key.ok) return;
    expect(key.value.modulusHex).toHaveLength(TEST_KEY_BITS / 4);
    expect(key.value.exponentHex).toBe('10001');
  });

  it('falha com PEM inválido sem lançar exceção', () => {
    expect(readPublicKeyHex('não é um certificado').ok).toBe(false);
  });
});
