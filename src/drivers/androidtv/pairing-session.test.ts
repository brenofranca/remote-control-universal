import { readPublicKeyHex } from './certificate';
import { PAIRING_PORT } from './constants';
import { PairingSession, type PairingDependencies } from './pairing-session';
import { PinStore, toPin } from './pin';
import type { ClientIdentity, KeyValueStore, PeerCertificate } from './ports';
import { computePairingSecret } from './protocol/pairing-secret';
import { forgeSha256 } from './protocol/sha256-forge';
import { FakeConnector, FakeTlsConnection, type Responder } from './testing/fake-tls';
import { generateClientIdentityForTests } from './testing/identity';
import { poloErrorFromTv, poloFromTv, poloFieldSentByClient, secretSentByClient } from './testing/tv-messages';

const TARGET = { id: 'tcl-sala', address: '192.168.0.50' };
const SERVER_CERT: PeerCertificate = { modulusHex: 'D1' + '3C'.repeat(126) + '09', exponentHex: '010001' };
const HEX_RADIX = 16;
const BYTE_COUNT = 256;

const DEFAULT_REPLIES: Record<string, Uint8Array[]> = {
  pairingRequest: [poloFromTv('pairingRequestAck')],
  options: [poloFromTv('options')],
  configuration: [poloFromTv('configurationAck')],
  secret: [poloFromTv('secretAck')],
};

const tvResponder =
  (overrides: Record<string, Uint8Array[]> = {}): Responder =>
  (payload) => {
    const field = poloFieldSentByClient(payload);
    return overrides[field] ?? DEFAULT_REPLIES[field] ?? [];
  };

const memoryStore = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { get: async (key) => data.get(key) ?? null, set: async (key, value) => void data.set(key, value) };
};

let identity: ClientIdentity;
beforeAll(async () => {
  identity = await generateClientIdentityForTests();
}, 120_000);

const deps = (connector: FakeConnector, store = memoryStore()): PairingDependencies => ({
  connector,
  identity,
  sha256: forgeSha256,
  pins: new PinStore(store),
  responseTimeoutMs: 100,
});

const secretFor = (code: string) => {
  const client = readPublicKeyHex(identity.certificatePem);
  if (!client.ok) throw new Error('certificado de teste inválido');
  return computePairingSecret({
    clientModulusHex: client.value.modulusHex,
    clientExponentHex: client.value.exponentHex,
    serverModulusHex: SERVER_CERT.modulusHex,
    serverExponentHex: SERVER_CERT.exponentHex,
    code,
    sha256: forgeSha256,
  });
};

// O primeiro byte do código precisa bater com o hash; procura um código aceito para a identidade do teste.
const validCode = (): string => {
  for (let first = 0; first < BYTE_COUNT; first++) {
    const code = first.toString(HEX_RADIX).padStart(2, '0') + 'ABCD';
    if (secretFor(code).ok) return code;
  }
  throw new Error('nenhum código válido encontrado');
};

const startSession = async (respond: Responder = tvResponder(), store = memoryStore()) => {
  const tv = new FakeTlsConnection(SERVER_CERT, respond);
  const result = await PairingSession.begin(deps(new FakeConnector([tv]), store), TARGET, 'Meu iPhone');
  return { tv, store, result };
};

describe('PairingSession.begin', () => {
  it('executa o handshake na ordem e deixa a conexão aberta para o código', async () => {
    const { tv, result } = await startSession();

    expect(result.ok).toBe(true);
    expect(tv.payloads.map(poloFieldSentByClient)).toEqual(['pairingRequest', 'options', 'configuration']);
    expect(tv.closed).toBe(false);
  });

  it('conecta na porta de pareamento com a identidade do cliente', async () => {
    const connector = new FakeConnector([new FakeTlsConnection(SERVER_CERT, tvResponder())]);
    await PairingSession.begin(deps(connector), TARGET, 'x');
    expect(connector.requests[0]).toMatchObject({ host: TARGET.address, port: PAIRING_PORT, identity });
  });

  it('rejeita endereço público sem abrir conexão', async () => {
    const connector = new FakeConnector([]);
    const result = await PairingSession.begin(deps(connector), { id: 'x', address: '8.8.8.8' }, 'x');
    expect(result.ok).toBe(false);
    expect(connector.requests).toHaveLength(0);
  });

  it('falha com CONNECTION_FAILED quando o connect lança erro', async () => {
    const result = await PairingSession.begin(deps(new FakeConnector(new Error('recusado'))), TARGET, 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONNECTION_FAILED');
  });

  it('falha com TIMEOUT e fecha a conexão se a TV não responde', async () => {
    const { tv, result } = await startSession(() => []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TIMEOUT');
    expect(tv.closed).toBe(true);
  });

  it('falha com PAIRING_FAILED se a TV recusa com status de erro', async () => {
    const { result } = await startSession(tvResponder({ pairingRequest: [poloErrorFromTv(400)] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PAIRING_FAILED');
  });

  it('falha com PROTOCOL_ERROR se a TV responde a mensagem errada', async () => {
    const { result } = await startSession(tvResponder({ pairingRequest: [poloFromTv('secretAck')] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PROTOCOL_ERROR');
  });

  it('falha se a TV derrubar a conexão durante o handshake', async () => {
    const tv = new FakeTlsConnection(SERVER_CERT, () => []);
    const pending = PairingSession.begin(deps(new FakeConnector([tv])), TARGET, 'x');
    await Promise.resolve();
    tv.drop();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONNECTION_FAILED');
  });
});

describe('PairingSession.submitCode', () => {
  const started = async (respond: Responder = tvResponder(), store = memoryStore()) => {
    const { tv, result } = await startSession(respond, store);
    if (!result.ok) throw new Error('handshake falhou');
    return { session: result.value, tv, store };
  };

  it('envia o segredo esperado, fecha a conexão e grava o pin da TV', async () => {
    const { session, tv, store } = await started();
    const code = validCode();
    const expected = secretFor(code);
    if (!expected.ok) throw new Error('código de teste inválido');

    const result = await session.submitCode(code);

    expect(result.ok).toBe(true);
    expect(secretSentByClient(tv.payloads[3])).toEqual(expected.value);
    expect(tv.closed).toBe(true);
    expect(await new PinStore(store).get(TARGET.id)).toBe(toPin(SERVER_CERT));
  });

  it('código com erro de digitação não envia nada nem encerra a sessão', async () => {
    const { session, tv } = await started();
    const code = validCode();
    const wrong = code.startsWith('00') ? '01ABCD' : '00ABCD';

    const result = await session.submitCode(wrong);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('PAIRING_FAILED');
    expect(tv.payloads).toHaveLength(3);
    expect(tv.closed).toBe(false);
    expect((await session.submitCode(code)).ok).toBe(true);
  });

  it('não grava pin quando a TV recusa o segredo', async () => {
    const { session, store } = await started(tvResponder({ secret: [poloErrorFromTv(402)] }));
    const result = await session.submitCode(validCode());

    expect(result.ok).toBe(false);
    expect(await new PinStore(store).get(TARGET.id)).toBeNull();
  });

  it('só permite um envio de segredo por sessão', async () => {
    const { session } = await started();
    const code = validCode();
    await session.submitCode(code);
    expect((await session.submitCode(code)).ok).toBe(false);
  });

  it('falha se a TV não expõe certificado', async () => {
    const tv = new FakeTlsConnection(null, tvResponder());
    const session = await PairingSession.begin(deps(new FakeConnector([tv])), TARGET, 'x');
    if (!session.ok) throw new Error('handshake falhou');
    expect((await session.value.submitCode('AABBCC')).ok).toBe(false);
  });

  it('cancel fecha a conexão e impede novo envio', async () => {
    const { session, tv } = await started();
    session.cancel();
    expect(tv.closed).toBe(true);
    expect((await session.submitCode(validCode())).ok).toBe(false);
  });
});
