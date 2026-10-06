import type { TvDevice } from '@/domain/tv-device';
import { parsePrivateIPv4 } from '@/security/private-address';

const STORE_KEY = 'saved-tvs';
const LEGACY_STORE_KEY = 'last-tv';
const MAX_PORT = 65535;
// SecureStore avisa acima de 2 KB por valor; 10 TVs ficam bem abaixo disso.
export const MAX_SAVED_TVS = 10;

export interface StringStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface SavedTvs {
  readonly devices: readonly TvDevice[];
  readonly lastId: string | null;
}

const EMPTY: SavedTvs = { devices: [], lastId: null };

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

const pick = ({ id, name, address, port, protocol }: TvDevice): TvDevice => ({ id, name, address, port, protocol });

const parse = (raw: string | null): unknown => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const toSavedTvs = (value: unknown): SavedTvs => {
  if (typeof value !== 'object' || value === null) return EMPTY;
  const { devices, lastId } = value as Record<string, unknown>;
  const valid = Array.isArray(devices) ? devices.filter(isTvDevice).slice(0, MAX_SAVED_TVS).map(pick) : [];
  const last = typeof lastId === 'string' && valid.some((device) => device.id === lastId) ? lastId : null;
  return { devices: valid, lastId: last };
};

export class SavedTvRepository {
  constructor(private readonly store: StringStore) {}

  async load(): Promise<SavedTvs> {
    try {
      const current = await this.store.get(STORE_KEY);
      if (current !== null) return toSavedTvs(parse(current));
      return await this.migrateLegacy();
    } catch {
      return EMPTY;
    }
  }

  async remember(device: TvDevice): Promise<SavedTvs> {
    const { devices } = await this.load();
    const others = devices.filter((saved) => saved.id !== device.id);
    return this.write({ devices: [pick(device), ...others].slice(0, MAX_SAVED_TVS), lastId: device.id });
  }

  async remove(deviceId: string): Promise<SavedTvs> {
    const { devices, lastId } = await this.load();
    return this.write({ devices: devices.filter((saved) => saved.id !== deviceId), lastId: lastId === deviceId ? null : lastId });
  }

  async clearLast(): Promise<SavedTvs> {
    const { devices } = await this.load();
    return this.write({ devices, lastId: null });
  }

  private async write(saved: SavedTvs): Promise<SavedTvs> {
    await this.store.set(STORE_KEY, JSON.stringify(saved));
    return saved;
  }

  // Versão anterior guardava só a última TV, em outra chave.
  private async migrateLegacy(): Promise<SavedTvs> {
    const legacy = parse(await this.store.get(LEGACY_STORE_KEY));
    if (!isTvDevice(legacy)) return EMPTY;
    const saved = await this.write({ devices: [pick(legacy)], lastId: legacy.id });
    await this.store.remove(LEGACY_STORE_KEY);
    return saved;
  }
}
