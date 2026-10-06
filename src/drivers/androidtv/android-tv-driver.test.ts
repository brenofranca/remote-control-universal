import { RemoteKey } from '@/domain/remote-key';
import { TvApp } from '@/domain/tv-app';
import type { TvDevice } from '@/domain/tv-device';
import { AndroidTvDriver } from './android-tv-driver';
import { IdentityRepository } from './identity-repository';
import { PinStore, toPin } from './pin';
import type { ClientIdentity, KeyValueStore, PeerCertificate } from './ports';
import { Feature } from './protocol/remote';
import { forgeSha256 } from './protocol/sha256-forge';
import { decodeRemoteMessageForTests } from './testing/decode-client-remote';
import { FakeConnector, FakeTlsConnection, type Responder } from './testing/fake-tls';
import {
  poloFieldSentByClient,
  poloFromTv,
  remoteConfigureFromTv,
  remoteSetActiveFromTv,
  remoteStartFromTv,
} from './testing/tv-messages';

const IDENTITY: ClientIdentity = { certificatePem: 'CERT', privateKeyPem: 'KEY' };
const SERVER_CERT: PeerCertificate = { modulusHex: 'D1' + '3C'.repeat(254) + '09', exponentHex: '010001' };
const DEVICE: TvDevice = { id: 'tcl-sala', name: 'TCL Sala', address: '192.168.0.50', port: 6466, protocol: 'androidtv' };
const KEYCODE_HOME = 3;
const SHORT_PRESS = 3;

const memoryStore = (): KeyValueStore => {
  const data = new Map<string, string>();
  return { get: async (key) => data.get(key) ?? null, set: async (key, value) => void data.set(key, value) };
};

const cooperativeTv: Responder = (payload) => {
  const event = decodeRemoteMessageForTests(payload);
  if (event === 'configure') return [remoteSetActiveFromTv()];
  if (event.startsWith('setActive')) return [remoteStartFromTv(true)];
  return [];
};

const pairingTv: Responder = (payload) => {
  const replies: Record<string, ReturnType<typeof poloFromTv>[]> = {
    pairingRequest: [poloFromTv('pairingRequestAck')],
    options: [poloFromTv('options')],
    configuration: [poloFromTv('configurationAck')],
  };
  return replies[poloFieldSentByClient(payload)] ?? [];
};

const remoteTv = () => {
  const tv = new FakeTlsConnection(SERVER_CERT, cooperativeTv);
  tv.emit(remoteConfigureFromTv(Feature.PING | Feature.KEY | Feature.POWER | Feature.VOLUME | Feature.APP_LINK));
  return tv;
};

const setup = async (connections: FakeTlsConnection[], paired = true) => {
  const pins = new PinStore(memoryStore());
  if (paired) await pins.save(DEVICE.id, toPin(SERVER_CERT));
  const connector = new FakeConnector(connections);
  const generate = jest.fn(async () => IDENTITY);
  const driver = new AndroidTvDriver({
    connector,
    identities: new IdentityRepository(memoryStore(), generate),
    pins,
    sha256: forgeSha256,
  });
  return { driver, connector, generate };
};

describe('AndroidTvDriver', () => {
  it('começa desconectado e não envia teclas', async () => {
    const { driver } = await setup([]);
    expect(driver.status).toBe('disconnected');
    const result = await driver.sendKey(RemoteKey.Home);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_CONNECTED');
  });

  it('conecta, fica conectado e usa a identidade do repositório', async () => {
    const { driver, connector } = await setup([remoteTv()]);
    const result = await driver.connect(DEVICE);

    expect(result.ok).toBe(true);
    expect(driver.status).toBe('connected');
    expect(connector.requests[0].identity).toEqual(IDENTITY);
  });

  it('traduz RemoteKey para o keycode Android e envia', async () => {
    const tv = remoteTv();
    const { driver } = await setup([tv]);
    await driver.connect(DEVICE);

    const result = await driver.sendKey(RemoteKey.Home);

    expect(result.ok).toBe(true);
    expect(decodeRemoteMessageForTests(tv.payloads[tv.payloads.length - 1])).toBe(`key:${KEYCODE_HOME}:${SHORT_PRESS}`);
  });

  it('abre app traduzindo TvApp para o link Android', async () => {
    const tv = remoteTv();
    const { driver } = await setup([tv]);
    await driver.connect(DEVICE);

    expect((await driver.launchApp(TvApp.YouTube)).ok).toBe(true);
    expect(decodeRemoteMessageForTests(tv.payloads[tv.payloads.length - 1])).toBe('appLink:market://launch?id=com.google.android.youtube.tv');
  });

  it('não abre app sem conexão', async () => {
    const { driver } = await setup([]);
    const result = await driver.launchApp(TvApp.Netflix);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_CONNECTED');
  });

  it('rejeita tecla desconhecida sem enviar nada', async () => {
    const tv = remoteTv();
    const { driver } = await setup([tv]);
    await driver.connect(DEVICE);
    const sentBefore = tv.payloads.length;

    const result = await driver.sendKey('HACK' as RemoteKey);

    expect(result.ok).toBe(false);
    expect(tv.payloads).toHaveLength(sentBefore);
  });

  it('volta a desconectado se a conexão falhar', async () => {
    const { driver } = await setup([remoteTv()], false);
    const result = await driver.connect(DEVICE);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNTRUSTED_DEVICE');
    expect(driver.status).toBe('disconnected');
  });

  it('atualiza o status quando a TV derruba a conexão', async () => {
    const tv = remoteTv();
    const { driver } = await setup([tv]);
    await driver.connect(DEVICE);

    tv.drop();

    expect(driver.status).toBe('disconnected');
    expect((await driver.sendKey(RemoteKey.Home)).ok).toBe(false);
  });

  it('avisa os ouvintes a cada mudança de status, inclusive na queda', async () => {
    const tv = remoteTv();
    const { driver } = await setup([tv]);
    const statuses: string[] = [];
    const unsubscribe = driver.onStatusChange((status) => statuses.push(status));

    await driver.connect(DEVICE);
    tv.drop();
    unsubscribe();
    await driver.disconnect();

    expect(statuses).toEqual(['connecting', 'connected', 'disconnected']);
  });

  it('isPaired indica se existe pin salvo para a TV', async () => {
    const paired = await setup([]);
    const unpaired = await setup([], false);
    expect(await paired.driver.isPaired(DEVICE)).toBe(true);
    expect(await unpaired.driver.isPaired(DEVICE)).toBe(false);
  });

  it('disconnect fecha a sessão e é idempotente', async () => {
    const tv = remoteTv();
    const { driver } = await setup([tv]);
    await driver.connect(DEVICE);

    await driver.disconnect();
    await driver.disconnect();

    expect(tv.closed).toBe(true);
    expect(driver.status).toBe('disconnected');
  });

  it('reconectar fecha a sessão anterior', async () => {
    const first = remoteTv();
    const second = remoteTv();
    const { driver } = await setup([first, second]);
    await driver.connect(DEVICE);
    await driver.connect(DEVICE);

    expect(first.closed).toBe(true);
    expect(driver.status).toBe('connected');
  });

  it('a queda da sessão antiga não derruba a nova', async () => {
    const first = remoteTv();
    const second = remoteTv();
    const { driver } = await setup([first, second]);
    await driver.connect(DEVICE);
    await driver.connect(DEVICE);

    first.drop();

    expect(driver.status).toBe('connected');
  });

  it('recusa conexão simultânea', async () => {
    const { driver } = await setup([remoteTv(), remoteTv()]);
    const [first, second] = await Promise.all([driver.connect(DEVICE), driver.connect(DEVICE)]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
  });

  it('não fica preso em connecting se a identidade não puder ser carregada', async () => {
    const { driver, generate } = await setup([remoteTv()]);
    generate.mockRejectedValueOnce(new Error('keychain indisponível'));

    const failed = await driver.connect(DEVICE);
    expect(failed.ok).toBe(false);
    expect(driver.status).toBe('disconnected');

    expect((await driver.connect(DEVICE)).ok).toBe(true);
  });

  it('beginPairing falha sem lançar se a identidade não puder ser carregada', async () => {
    const { driver, generate } = await setup([]);
    generate.mockRejectedValueOnce(new Error('keychain indisponível'));
    expect((await driver.beginPairing(DEVICE)).ok).toBe(false);
  });

  it('beginPairing inicia o handshake de pareamento com a identidade do cliente', async () => {
    const tv = new FakeTlsConnection(SERVER_CERT, pairingTv);
    const { driver, connector } = await setup([tv], false);

    const result = await driver.beginPairing(DEVICE);

    expect(result.ok).toBe(true);
    expect(connector.requests[0]).toMatchObject({ port: 6467, identity: IDENTITY });
    expect(tv.payloads.map(poloFieldSentByClient)).toEqual(['pairingRequest', 'options', 'configuration']);
  });

  it('gera a identidade apenas uma vez entre pareamento e conexão', async () => {
    const { driver, generate } = await setup([new FakeTlsConnection(SERVER_CERT, pairingTv), remoteTv()]);
    await driver.beginPairing(DEVICE);
    await driver.connect(DEVICE);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
