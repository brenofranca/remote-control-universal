import { createStore, type StoreApi } from 'zustand/vanilla';
import type { DomainError } from '@/domain/errors';
import { domainError } from '@/domain/errors';
import { fail, type Result } from '@/domain/result';
import type { RemoteKey } from '@/domain/remote-key';
import type { TvDevice } from '@/domain/tv-device';
import type { ConnectionStatus } from '@/domain/tv-driver';
import type { SavedTvRepository } from './saved-tv-repository';

export interface PairingHandle {
  submitCode(code: string): Promise<Result<void>>;
  cancel(): void;
}

export interface RemoteDriver {
  readonly status: ConnectionStatus;
  onStatusChange(listener: (status: ConnectionStatus) => void): () => void;
  isPaired(device: TvDevice): Promise<boolean>;
  connect(device: TvDevice): Promise<Result<void>>;
  disconnect(): Promise<void>;
  sendKey(key: RemoteKey): Promise<Result<void>>;
  beginPairing(device: TvDevice): Promise<Result<PairingHandle>>;
}

export type SelectOutcome = 'connected' | 'pairing' | 'failed';

export interface RemoteState {
  readonly device: TvDevice | null;
  readonly status: ConnectionStatus;
  readonly error: DomainError | null;
  readonly pairingDevice: TvDevice | null;
  readonly busy: boolean;
  restore(): Promise<TvDevice | null>;
  select(device: TvDevice): Promise<SelectOutcome>;
  startPairing(device: TvDevice): Promise<boolean>;
  submitCode(code: string): Promise<boolean>;
  cancelPairing(): void;
  reconnect(): Promise<boolean>;
  sendKey(key: RemoteKey): Promise<Result<void>>;
  forget(): Promise<void>;
  clearError(): void;
}

export interface RemoteStoreDependencies {
  readonly driver: RemoteDriver;
  readonly savedTvs: SavedTvRepository;
}

const RECONNECTABLE: readonly DomainError['code'][] = ['NOT_CONNECTED', 'CONNECTION_FAILED'];

export const createRemoteStore = ({ driver, savedTvs }: RemoteStoreDependencies): StoreApi<RemoteState> => {
  let pairing: PairingHandle | null = null;
  let reconnecting: Promise<boolean> | null = null;

  return createStore<RemoteState>()((set, get) => {
    driver.onStatusChange((status) => set({ status }));

    const connect = async (device: TvDevice): Promise<boolean> => {
      set({ busy: true, error: null, device });
      const result = await driver.connect(device);
      set({ busy: false, error: result.ok ? null : result.error });
      if (result.ok) await savedTvs.save(device);
      return result.ok;
    };

    const startPairing = async (device: TvDevice): Promise<boolean> => {
      pairing?.cancel();
      pairing = null;
      set({ busy: true, error: null, pairingDevice: device });
      const started = await driver.beginPairing(device);
      if (!started.ok) {
        set({ busy: false, error: started.error, pairingDevice: null });
        return false;
      }
      pairing = started.value;
      set({ busy: false });
      return true;
    };

    return {
      device: null,
      status: driver.status,
      error: null,
      pairingDevice: null,
      busy: false,

      async restore() {
        const device = await savedTvs.load();
        set({ device });
        return device;
      },

      async select(device) {
        if (!(await driver.isPaired(device))) return (await startPairing(device)) ? 'pairing' : 'failed';
        if (await connect(device)) return 'connected';
        return get().error?.code === 'UNTRUSTED_DEVICE' && (await startPairing(device)) ? 'pairing' : 'failed';
      },

      startPairing,

      async submitCode(code) {
        const device = get().pairingDevice;
        if (!pairing || !device) {
          set({ error: domainError('PAIRING_FAILED', 'Inicie o pareamento novamente.') });
          return false;
        }
        set({ busy: true, error: null });
        const handle = pairing;
        pairing = null;
        const result = await handle.submitCode(code.trim().toUpperCase());
        if (!result.ok) {
          // Código errado é detectado antes de enviar: a sessão continua aberta para nova tentativa.
          const retryable = result.error.code === 'PAIRING_FAILED';
          if (retryable) pairing = handle;
          set({ busy: false, error: result.error, pairingDevice: retryable ? device : null });
          return false;
        }
        set({ pairingDevice: null });
        return connect(device);
      },

      cancelPairing() {
        pairing?.cancel();
        pairing = null;
        set({ pairingDevice: null, busy: false });
      },

      reconnect() {
        const device = get().device;
        if (!device) return Promise.resolve(false);
        if (driver.status === 'connected') return Promise.resolve(true);
        reconnecting ??= connect(device).finally(() => {
          reconnecting = null;
        });
        return reconnecting;
      },

      async sendKey(key) {
        const sent = await driver.sendKey(key);
        if (sent.ok || !RECONNECTABLE.includes(sent.error.code)) return sent;
        if (!(await get().reconnect())) return fail(get().error ?? sent.error);
        return driver.sendKey(key);
      },

      async forget() {
        await driver.disconnect();
        await savedTvs.forget();
        set({ device: null, error: null });
      },

      clearError() {
        set({ error: null });
      },
    };
  });
};

