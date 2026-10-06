import type { TvDevice } from '@/domain/tv-device';
import { parsePrivateIPv4 } from '@/security/private-address';

const STORE_KEY = 'last-tv';
const MAX_PORT = 65535;

export interface StringStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const isTvDevice = (value: unknown): value is TvDevice => {
  if (typeof value !== 'object' || value === null) return false;
  const device = value as Record<string, unknown>;
  return (
    typeof device.id === 'string' &&
    typeof device.name === 'string' &&
    typeof device.address === 'string' &&
    parsePrivateIPv4(device.address).ok &&
    Number.isInteger(device.port) &&
    (device.port as number) > 0 &&
    (device.port as number) <= MAX_PORT &&
    device.protocol === 'androidtv'
  );
};

export class SavedTvRepository {
  constructor(private readonly store: StringStore) {}

  async load(): Promise<TvDevice | null> {
    try {
      const raw = await this.store.get(STORE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return isTvDevice(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  save(device: TvDevice): Promise<void> {
    const { id, name, address, port, protocol } = device;
    return this.store.set(STORE_KEY, JSON.stringify({ id, name, address, port, protocol }));
  }

  forget(): Promise<void> {
    return this.store.remove(STORE_KEY);
  }
}
