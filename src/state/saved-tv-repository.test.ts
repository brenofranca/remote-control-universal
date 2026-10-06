import type { TvDevice } from '@/domain/tv-device';
import { SavedTvRepository, type StringStore } from './saved-tv-repository';

const DEVICE: TvDevice = { id: 'mdns:TCL', name: 'TCL', address: '192.168.0.50', port: 6466, protocol: 'androidtv' };

const memoryStore = (initial?: string): StringStore => {
  const data = new Map<string, string>(initial ? [['last-tv', initial]] : []);
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  };
};

describe('SavedTvRepository', () => {
  it('salva, carrega e esquece a TV', async () => {
    const repository = new SavedTvRepository(memoryStore());
    expect(await repository.load()).toBeNull();
    await repository.save(DEVICE);
    expect(await repository.load()).toEqual(DEVICE);
    await repository.forget();
    expect(await repository.load()).toBeNull();
  });

  it('ignora conteúdo corrompido ou com IP público', async () => {
    expect(await new SavedTvRepository(memoryStore('{nao-json')).load()).toBeNull();
    expect(await new SavedTvRepository(memoryStore(JSON.stringify({ ...DEVICE, address: '8.8.8.8' }))).load()).toBeNull();
    expect(await new SavedTvRepository(memoryStore(JSON.stringify({ ...DEVICE, port: 0 }))).load()).toBeNull();
  });
});
