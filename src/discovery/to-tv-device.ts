import { parsePrivateIPv4 } from '@/security/private-address';
import type { TvDevice } from '@/domain/tv-device';

export const ANDROID_TV_SERVICE = { type: 'androidtvremote2', protocol: 'tcp' } as const;

const MAX_NAME_LENGTH = 64;

export interface DiscoveredService {
  readonly name: string;
  readonly port: number;
  readonly ipv4: readonly string[];
}

const cleanName = (name: string): string => name.trim().slice(0, MAX_NAME_LENGTH) || 'Android TV';

// Só endereços privados viram TvDevice: o anúncio mDNS vem da rede e não é confiável.
export const toTvDevice = (service: DiscoveredService): TvDevice | null => {
  const address = service.ipv4.map(parsePrivateIPv4).find((result) => result.ok);
  if (!address?.ok) return null;
  return { id: `mdns:${service.name}`, name: cleanName(service.name), address: address.value, port: service.port, protocol: 'androidtv' };
};

export const manualTvDevice = (address: string): TvDevice | null => {
  const parsed = parsePrivateIPv4(address.trim());
  if (!parsed.ok) return null;
  return { id: `ip:${parsed.value}`, name: `TV (${parsed.value})`, address: parsed.value, port: 6466, protocol: 'androidtv' };
};
