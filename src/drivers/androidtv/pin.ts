import type { KeyValueStore, PeerCertificate } from './ports';

const HEX_STORE_KEY_PREFIX = 'atv-pin-';
const HEX_RADIX = 16;
const BYTE_HEX_LENGTH = 2;

const normalizeHex = (hex: string): string => hex.toLowerCase().replace(/^0+/, '');

export const toPin = (certificate: PeerCertificate): string =>
  `${normalizeHex(certificate.modulusHex)}:${normalizeHex(certificate.exponentHex)}`;

// SecureStore só aceita [A-Za-z0-9._-] em chaves; o id do dispositivo vem da rede e pode ter qualquer caractere.
const toStoreKey = (deviceId: string): string =>
  HEX_STORE_KEY_PREFIX +
  Array.from(new TextEncoder().encode(deviceId), (byte) => byte.toString(HEX_RADIX).padStart(BYTE_HEX_LENGTH, '0')).join('');

export class PinStore {
  constructor(private readonly store: KeyValueStore) {}

  get(deviceId: string): Promise<string | null> {
    return this.store.get(toStoreKey(deviceId));
  }

  save(deviceId: string, pin: string): Promise<void> {
    return this.store.set(toStoreKey(deviceId), pin);
  }
}
