import { REMOTE_PORT } from './constants';
import { PinStore, toPin } from './pin';
import type { ClientIdentity, KeyValueStore, PeerCertificate } from './ports';
import { RemoteSession, type RemoteDependencies } from './remote-session';
import { Feature } from './protocol/remote';
import { decodeRemoteMessageForTests } from './testing/decode-client-remote';
import { FakeConnector, FakeTlsConnection, type Responder } from './testing/fake-tls';
import {
  remoteConfigureFromTv,
  remoteErrorFromTv,
  remotePingFromTv,
  remoteSetActiveFromTv,
  remoteStartFromTv,
} from './testing/tv-messages';

const TARGET = { id: 'tcl-sala', address: '192.168.0.50' };
const SERVER_CERT: PeerCertificate = { modulusHex: 'D1' + '3C'.repeat(254) + '09', exponentHex: '010001' };
const OTHER_CERT: PeerCertificate = { modulusHex: 'AA' + '11'.repeat(254) + '01', exponentHex: '010001' };
const IDENTITY: ClientIdentity = { certificatePem: 'CERT', privateKeyPem: 'KEY' };
const TV_FEATURES = Feature.PING | Feature.KEY | Feature.IME | Feature.VOICE | Feature.POWER | Feature.VOLUME | Feature.APP_LINK;
const NEGOTIATED = Feature.PING | Feature.KEY | Feature.POWER | Feature.VOLUME | Feature.APP_LINK;
const KEYCODE_HOME = 3;

const memoryStore = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { get: async (key) => data.get(key) ?? null, set: async (key, value) => void data.set(key, value) };
};

const pairedPins = async (cert: PeerCertificate | null = SERVER_CERT): Promise<PinStore> => {
  const pins = new PinStore(memoryStore());
  if (cert) await pins.save(TARGET.id, toPin(cert));
  return pins;
};

// Simula a TV: ao receber o RemoteConfigure do cliente, continua o handshake com set_active e start.
const cooperativeTv: Responder = (payload) => {
  const event = decodeRemoteMessageForTests(payload);
  if (event === 'configure') return [remoteSetActiveFromTv()];
  if (event.startsWith('setActive')) return [remoteStartFromTv(true)];
  return [];
};

const openWith = async (tv: FakeTlsConnection, pins: PinStore, extra: Partial<RemoteDependencies> = {}) => {
  const connector = new FakeConnector([tv]);
  const result = await RemoteSession.open(
    { connector, identity: IDENTITY, pins, responseTimeoutMs: 100, ...extra },
    TARGET,
  );
  return { result, connector };
};

const connectedTv = (respond: Responder = cooperativeTv) => {
  const tv = new FakeTlsConnection(SERVER_CERT, respond);
  queueMicrotask(() => tv.emit(remoteConfigureFromTv(TV_FEATURES)));
  return tv;
};

describe('RemoteSession.open', () => {
  it('conclui o handshake, negocia features e conecta na porta de controle', async () => {
    const tv = connectedTv();
    const { result, connector } = await openWith(tv, await pairedPins());

    expect(result.ok).toBe(true);
    expect(connector.requests[0]).toMatchObject({ host: TARGET.address, port: REMOTE_PORT });
    expect(tv.payloads.map(decodeRemoteMessageForTests)).toEqual(['configure', `setActive:${NEGOTIATED}`]);
  });

  it('recusa TV que nunca foi pareada, sem enviar nada', async () => {
    const tv = connectedTv();
    const { result } = await openWith(tv, await pairedPins(null));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNTRUSTED_DEVICE');
    expect(tv.payloads).toHaveLength(0);
    expect(tv.closed).toBe(true);
  });

  it('recusa TV cujo certificado mudou em relação ao pin', async () => {
    const tv = connectedTv();
    const { result } = await openWith(tv, await pairedPins(OTHER_CERT));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNTRUSTED_DEVICE');
    expect(tv.payloads).toHaveLength(0);
  });

  it('recusa TV sem certificado', async () => {
    const tv = new FakeTlsConnection(null, cooperativeTv);
    const { result } = await openWith(tv, await pairedPins());
    expect(result.ok).toBe(false);
  });

  it('rejeita endereço público sem abrir conexão', async () => {
    const connector = new FakeConnector([]);
    const result = await RemoteSession.open(
      { connector, identity: IDENTITY, pins: await pairedPins() },
      { id: TARGET.id, address: '1.1.1.1' },
    );
    expect(result.ok).toBe(false);
    expect(connector.requests).toHaveLength(0);
  });

  it('falha com TIMEOUT se a TV não fica pronta', async () => {
    const tv = new FakeTlsConnection(SERVER_CERT, () => []);
    const { result } = await openWith(tv, await pairedPins());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TIMEOUT');
    expect(tv.closed).toBe(true);
  });

  it('falha se a TV não suporta envio de teclas', async () => {
    const tv = new FakeTlsConnection(SERVER_CERT, cooperativeTv);
    queueMicrotask(() => tv.emit(remoteConfigureFromTv(Feature.PING)));
    const { result } = await openWith(tv, await pairedPins());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_KEY');
  });

  it('falha se a TV reporta erro durante o handshake', async () => {
    const tv = new FakeTlsConnection(SERVER_CERT, () => []);
    queueMicrotask(() => tv.emit(remoteErrorFromTv()));
    const { result } = await openWith(tv, await pairedPins());
    expect(result.ok).toBe(false);
  });
});

describe('RemoteSession (conectada)', () => {
  const openSession = async (extra: Partial<RemoteDependencies> = {}) => {
    const tv = connectedTv();
    const { result } = await openWith(tv, await pairedPins(), extra);
    if (!result.ok) throw new Error('não conectou');
    return { session: result.value, tv };
  };

  it('responde ping ecoando o valor recebido', async () => {
    const { tv } = await openSession();
    tv.emit(remotePingFromTv(42));
    expect(decodeRemoteMessageForTests(tv.payloads[tv.payloads.length - 1])).toBe('pingResponse:42');
  });

  it('envia teclas com o keycode e a direção corretos', async () => {
    const { session, tv } = await openSession();
    expect(session.sendKey(KEYCODE_HOME).ok).toBe(true);
    expect(decodeRemoteMessageForTests(tv.payloads[tv.payloads.length - 1])).toBe(`key:${KEYCODE_HOME}:3`);
  });

  it('aplica rate limit nas teclas', async () => {
    const { session } = await openSession({ keyLimiter: { tryAcquire: jest.fn().mockReturnValueOnce(true).mockReturnValue(false) } });
    expect(session.sendKey(KEYCODE_HOME).ok).toBe(true);
    const blocked = session.sendKey(KEYCODE_HOME);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('RATE_LIMITED');
  });

  it('avisa quando a TV derruba a conexão e recusa novas teclas', async () => {
    const { session, tv } = await openSession();
    const onClosed = jest.fn();
    session.onClosed(onClosed);

    tv.drop();

    expect(onClosed).toHaveBeenCalledTimes(1);
    const result = session.sendKey(KEYCODE_HOME);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_CONNECTED');
  });

  it('close fecha a conexão e é idempotente', async () => {
    const { session, tv } = await openSession();
    session.close();
    session.close();
    expect(tv.closed).toBe(true);
    expect(session.sendKey(KEYCODE_HOME).ok).toBe(false);
  });

  it('ativa apenas as features negociadas', async () => {
    const { tv } = await openSession();
    expect(decodeRemoteMessageForTests(tv.payloads[1])).toBe(`setActive:${NEGOTIATED}`);
  });
});
