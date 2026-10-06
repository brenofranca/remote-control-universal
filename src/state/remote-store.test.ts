import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { RemoteKey } from '@/domain/remote-key';
import type { TvDevice } from '@/domain/tv-device';
import type { ConnectionStatus } from '@/domain/tv-driver';
import { createRemoteStore, type PairingHandle, type RemoteDriver } from './remote-store';
import { SavedTvRepository } from './saved-tv-repository';

const DEVICE: TvDevice = { id: 'mdns:TCL', name: 'TCL', address: '192.168.0.50', port: 6466, protocol: 'androidtv' };

const memorySavedTvs = () => {
  const data = new Map<string, string>();
  return new SavedTvRepository({
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  });
};

const fakeDriver = (paired: boolean) => {
  const listeners: ((status: ConnectionStatus) => void)[] = [];
  const pairingHandle: jest.Mocked<PairingHandle> = {
    submitCode: jest.fn(async (_code: string): Promise<Result<void>> => ok(undefined)),
    cancel: jest.fn(),
  };
  const driver = {
    status: 'disconnected' as ConnectionStatus,
    onStatusChange: (listener: (status: ConnectionStatus) => void) => {
      listeners.push(listener);
      return () => undefined;
    },
    isPaired: jest.fn(async () => paired),
    connect: jest.fn(async (): Promise<Result<void>> => {
      driver.status = 'connected';
      listeners.forEach((listener) => listener('connected'));
      return ok(undefined);
    }),
    disconnect: jest.fn(async () => undefined),
    sendKey: jest.fn(async (): Promise<Result<void>> => ok(undefined)),
    beginPairing: jest.fn(async (): Promise<Result<PairingHandle>> => ok(pairingHandle)),
  } satisfies RemoteDriver;
  return { driver, pairingHandle };
};

describe('remote store', () => {
  it('TV já pareada conecta direto e fica salva', async () => {
    const { driver } = fakeDriver(true);
    const savedTvs = memorySavedTvs();
    const store = createRemoteStore({ driver, savedTvs });

    expect(await store.getState().select(DEVICE)).toBe('connected');
    expect(store.getState().status).toBe('connected');
    expect(await savedTvs.load()).toEqual(DEVICE);
  });

  it('TV nova passa pelo pareamento e conecta após o código', async () => {
    const { driver, pairingHandle } = fakeDriver(false);
    const store = createRemoteStore({ driver, savedTvs: memorySavedTvs() });

    expect(await store.getState().select(DEVICE)).toBe('pairing');
    expect(store.getState().pairingDevice).toEqual(DEVICE);
    expect(await store.getState().submitCode(' a1b2c3 ')).toBe(true);

    expect(pairingHandle.submitCode).toHaveBeenCalledWith('A1B2C3');
    expect(driver.connect).toHaveBeenCalledWith(DEVICE);
    expect(store.getState().pairingDevice).toBeNull();
  });

  it('código errado mantém a sessão para nova tentativa', async () => {
    const { driver, pairingHandle } = fakeDriver(false);
    const store = createRemoteStore({ driver, savedTvs: memorySavedTvs() });
    pairingHandle.submitCode.mockResolvedValueOnce(fail(domainError('PAIRING_FAILED', 'Código incorreto.')));

    await store.getState().select(DEVICE);
    expect(await store.getState().submitCode('000000')).toBe(false);
    expect(store.getState().error?.code).toBe('PAIRING_FAILED');
    expect(await store.getState().submitCode('A1B2C3')).toBe(true);
    expect(driver.beginPairing).toHaveBeenCalledTimes(1);
  });

  it('certificado diferente leva a novo pareamento', async () => {
    const { driver } = fakeDriver(true);
    driver.connect.mockResolvedValueOnce(fail(domainError('UNTRUSTED_DEVICE', 'O certificado da TV mudou.')));
    const store = createRemoteStore({ driver, savedTvs: memorySavedTvs() });

    expect(await store.getState().select(DEVICE)).toBe('pairing');
  });

  it('reconecta uma vez e reenvia a tecla quando a conexão caiu', async () => {
    const { driver } = fakeDriver(true);
    const store = createRemoteStore({ driver, savedTvs: memorySavedTvs() });
    await store.getState().select(DEVICE);
    driver.status = 'disconnected';
    driver.sendKey.mockResolvedValueOnce(fail(domainError('NOT_CONNECTED', 'Sem conexão.')));

    expect((await store.getState().sendKey(RemoteKey.Home)).ok).toBe(true);
    expect(driver.connect).toHaveBeenCalledTimes(2);
    expect(driver.sendKey).toHaveBeenCalledTimes(2);
  });

  it('não reconecta por erro que não é de conexão', async () => {
    const { driver } = fakeDriver(true);
    const store = createRemoteStore({ driver, savedTvs: memorySavedTvs() });
    await store.getState().select(DEVICE);
    driver.sendKey.mockResolvedValueOnce(fail(domainError('RATE_LIMITED', 'Muitas teclas.')));

    expect((await store.getState().sendKey(RemoteKey.Home)).ok).toBe(false);
    expect(driver.connect).toHaveBeenCalledTimes(1);
  });

  it('esquecer a TV desconecta e apaga o salvo', async () => {
    const { driver } = fakeDriver(true);
    const savedTvs = memorySavedTvs();
    const store = createRemoteStore({ driver, savedTvs });
    await store.getState().select(DEVICE);

    await store.getState().forget();

    expect(driver.disconnect).toHaveBeenCalled();
    expect(await savedTvs.load()).toBeNull();
    expect(store.getState().device).toBeNull();
  });
});
