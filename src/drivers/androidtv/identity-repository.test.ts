import { IdentityRepository } from './identity-repository';
import type { ClientIdentity, KeyValueStore } from './ports';

const identity: ClientIdentity = { certificatePem: 'CERT', privateKeyPem: 'KEY' };

const memoryStore = (initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map(Object.entries(initial));
  return { data, get: async (key) => data.get(key) ?? null, set: async (key, value) => void data.set(key, value) };
};

describe('IdentityRepository', () => {
  it('gera e persiste na primeira vez', async () => {
    const store = memoryStore();
    const generate = jest.fn(async () => identity);
    expect(await new IdentityRepository(store, generate).load()).toEqual(identity);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(store.data.size).toBe(2);
  });

  it('reutiliza a identidade salva sem gerar outra', async () => {
    const store = memoryStore();
    await new IdentityRepository(store, async () => identity).load();
    const generate = jest.fn(async () => ({ certificatePem: 'OUTRO', privateKeyPem: 'OUTRO' }));
    expect(await new IdentityRepository(store, generate).load()).toEqual(identity);
    expect(generate).not.toHaveBeenCalled();
  });

  it('chamadas simultâneas geram uma única identidade', async () => {
    const generate = jest.fn(async () => identity);
    const repository = new IdentityRepository(memoryStore(), generate);
    await Promise.all([repository.load(), repository.load(), repository.load()]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('regenera se só metade do par estiver salva', async () => {
    const generate = jest.fn(async () => identity);
    const store = memoryStore({ 'atv-client-certificate': 'CERT' });
    await new IdentityRepository(store, generate).load();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('propaga falha de geração e permite tentar de novo', async () => {
    const generate = jest.fn<Promise<ClientIdentity>, []>().mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce(identity);
    const repository = new IdentityRepository(memoryStore(), generate);
    await expect(repository.load()).rejects.toThrow('falhou');
    expect(await repository.load()).toEqual(identity);
  });
});
