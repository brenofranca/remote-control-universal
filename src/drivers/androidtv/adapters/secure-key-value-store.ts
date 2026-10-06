import type { KeyValueStore } from '../ports';

export interface SecureStoreApi {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string, options: { keychainAccessible: number }): Promise<void>;
}

export const createSecureKeyValueStore = (api: SecureStoreApi, keychainAccessible: number): KeyValueStore => ({
  get: (key) => api.getItemAsync(key),
  set: (key, value) => api.setItemAsync(key, value, { keychainAccessible }),
});
