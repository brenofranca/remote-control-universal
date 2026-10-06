import { createSecureKeyValueStore, type SecureStoreApi } from './secure-key-value-store';

const ACCESSIBLE_THIS_DEVICE_ONLY = 42;

describe('createSecureKeyValueStore', () => {
  const makeApi = (): jest.Mocked<SecureStoreApi> => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() });

  it('lê pelo SecureStore', async () => {
    const api = makeApi();
    api.getItemAsync.mockResolvedValue('valor');
    expect(await createSecureKeyValueStore(api, ACCESSIBLE_THIS_DEVICE_ONLY).get('k')).toBe('valor');
    expect(api.getItemAsync).toHaveBeenCalledWith('k');
  });

  it('grava restrito a este aparelho, para não ir a backups nem a outro dispositivo', async () => {
    const api = makeApi();
    await createSecureKeyValueStore(api, ACCESSIBLE_THIS_DEVICE_ONLY).set('k', 'v');
    expect(api.setItemAsync).toHaveBeenCalledWith('k', 'v', { keychainAccessible: ACCESSIBLE_THIS_DEVICE_ONLY });
  });
});
