import type { KeyValueStore } from './ports';
import { PinStore, toPin } from './pin';

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get: async (key) => data.get(key) ?? null, set: async (key, value) => void data.set(key, value) };
};

describe('toPin', () => {
  it('normaliza caixa e zeros à esquerda', () => {
    expect(toPin({ modulusHex: '00ABcd', exponentHex: '010001' })).toBe('abcd:10001');
  });

  it('certificados diferentes geram pins diferentes', () => {
    expect(toPin({ modulusHex: 'aa', exponentHex: '10001' })).not.toBe(toPin({ modulusHex: 'ab', exponentHex: '10001' }));
  });
});

describe('PinStore', () => {
  it('guarda e recupera o pin de um dispositivo', async () => {
    const pins = new PinStore(memoryStore());
    await pins.save('tv-1', 'abc:10001');
    expect(await pins.get('tv-1')).toBe('abc:10001');
    expect(await pins.get('tv-2')).toBeNull();
  });

  it('usa chaves compatíveis com o SecureStore mesmo com id exótico', async () => {
    const store = memoryStore();
    await new PinStore(store).save('TCL TV/sala:1 ✓', 'x');
    const [key] = Array.from(store.data.keys());
    expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('ids diferentes nunca colidem na mesma chave', async () => {
    const store = memoryStore();
    const pins = new PinStore(store);
    await pins.save('a b', '1');
    await pins.save('a_b', '2');
    expect(store.data.size).toBe(2);
  });
});
