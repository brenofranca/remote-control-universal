import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import TcpSocket from 'react-native-tcp-socket';
import { AndroidTvDriver } from './android-tv-driver';
import { createSecureKeyValueStore } from './adapters/secure-key-value-store';
import { generateRsaPrivateKeyPem } from './adapters/quick-crypto-rsa';
import { createTcpSocketConnector, type TlsSocketApi } from './adapters/tcp-socket-connector';
import { createIdentityGenerator } from './certificate';
import { IdentityRepository } from './identity-repository';
import { PinStore } from './pin';
import { forgeSha256 } from './protocol/sha256-forge';

export const createAndroidTvDriver = (): AndroidTvDriver => {
  const store = createSecureKeyValueStore(SecureStore, SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY);
  const generateIdentity = createIdentityGenerator({ generatePrivateKeyPem: generateRsaPrivateKeyPem, random: getRandomBytes });

  return new AndroidTvDriver({
    connector: createTcpSocketConnector(TcpSocket as unknown as TlsSocketApi),
    identities: new IdentityRepository(store, generateIdentity),
    pins: new PinStore(store),
    sha256: forgeSha256,
  });
};
