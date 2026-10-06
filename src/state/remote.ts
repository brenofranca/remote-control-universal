import * as SecureStore from 'expo-secure-store';
import { useStore } from 'zustand';
import { createAndroidTvDriver } from '@/drivers/androidtv/create-android-tv-driver';
import { createRemoteStore, type RemoteState } from './remote-store';
import { SavedTvRepository } from './saved-tv-repository';

const savedTvs = new SavedTvRepository({
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: (key) => SecureStore.deleteItemAsync(key),
});

export const remoteStore = createRemoteStore({ driver: createAndroidTvDriver(), savedTvs });

export const useRemote = <T>(selector: (state: RemoteState) => T): T => useStore(remoteStore, selector);
