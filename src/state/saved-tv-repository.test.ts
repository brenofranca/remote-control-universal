import type { TvDevice } from '@/domain/tv-device';
import { MAX_SAVED_TVS, SavedTvRepository, type StringStore } from './saved-tv-repository';

const tv = (n: number): TvDevice => ({ id: `mdns:TV ${n}`, name: `TV ${n}`, address: `192.168.0.${n}`, port: 6466, protocol: 'androidtv' });

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = new Map<string, string>(Object.entries(initial));
  const store: StringStore = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => void data.set(key, value),
    remove: async (key) => void data.delete(key),
  };
  return { store, data };
};

describe('SavedTvRepository', () => {
  it('começa vazio', async () => {
    expect(await new SavedTvRepository(memoryStore().store).load()).toEqual({ devices: [], lastId: null });
  });

  it('lembra TVs com a mais recente primeiro, sem duplicar', async () => {
    const repository = new SavedTvRepository(memoryStore().store);
    await repository.remember(tv(1));
    await repository.remember(tv(2));
    await repository.remember({ ...tv(1), address: '192.168.0.99' });

    const saved = await repository.load();
    expect(saved.devices.map((device) => device.id)).toEqual(['mdns:TV 1', 'mdns:TV 2']);
    expect(saved.devices[0].address).toBe('192.168.0.99');
    expect(saved.lastId).toBe('mdns:TV 1');
  });

  it(`guarda no máximo ${MAX_SAVED_TVS} TVs`, async () => {
    const repository = new SavedTvRepository(memoryStore().store);
    for (let n = 1; n <= MAX_SAVED_TVS + 2; n += 1) await repository.remember(tv(n));
    const saved = await repository.load();
    expect(saved.devices).toHaveLength(MAX_SAVED_TVS);
    expect(saved.devices[0].id).toBe(`mdns:TV ${MAX_SAVED_TVS + 2}`);
  });

  it('remove TV e limpa a última se for ela', async () => {
    const repository = new SavedTvRepository(memoryStore().store);
    await repository.remember(tv(1));
    await repository.remember(tv(2));
    expect(await repository.remove('mdns:TV 2')).toEqual({ devices: [tv(1)], lastId: null });
  });

  it('clearLast mantém a lista', async () => {
    const repository = new SavedTvRepository(memoryStore().store);
    await repository.remember(tv(1));
    expect(await repository.clearLast()).toEqual({ devices: [tv(1)], lastId: null });
  });

  it('migra a TV salva pela versão anterior', async () => {
    const { store, data } = memoryStore({ 'last-tv': JSON.stringify(tv(7)) });
    expect(await new SavedTvRepository(store).load()).toEqual({ devices: [tv(7)], lastId: 'mdns:TV 7' });
    expect(data.has('last-tv')).toBe(false);
  });

  it('descarta conteúdo corrompido e TVs inválidas', async () => {
    expect(await new SavedTvRepository(memoryStore({ 'saved-tvs': '{nao-json' }).store).load()).toEqual({ devices: [], lastId: null });
    const mixed = JSON.stringify({ devices: [tv(1), { ...tv(2), address: '8.8.8.8' }, { ...tv(3), port: 0 }, 'lixo'], lastId: 'mdns:TV 2' });
    expect(await new SavedTvRepository(memoryStore({ 'saved-tvs': mixed }).store).load()).toEqual({ devices: [tv(1)], lastId: null });
  });
});
