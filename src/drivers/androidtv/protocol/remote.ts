import { ok, type Result } from '@/domain/result';
import {
  concatBytes,
  findBytes,
  findVarint,
  lengthDelimitedField,
  parseFields,
  stringField,
  varintField,
  type WireField,
} from './wire';

export const Feature = {
  PING: 1,
  KEY: 2,
  IME: 4,
  VOICE: 8,
  POWER: 32,
  VOLUME: 64,
  APP_LINK: 512,
} as const;

const WANTED_FEATURES = Feature.PING | Feature.KEY | Feature.POWER | Feature.VOLUME | Feature.APP_LINK;
const CLIENT_PACKAGE_NAME = 'atvremote';
const CLIENT_APP_VERSION = '1.0.0';
const MAX_KEY_CODE = 2 ** 31 - 1;
const MAX_APP_LINK_LENGTH = 512;

const Field = {
  Configure: 1,
  SetActive: 2,
  Error: 3,
  PingRequest: 8,
  PingResponse: 9,
  KeyInject: 10,
  Start: 40,
  AppLinkLaunch: 90,
} as const;

const DIRECTION = { START_LONG: 1, END_LONG: 2, SHORT: 3 } as const;
export type KeyDirection = keyof typeof DIRECTION;

export type RemoteEvent =
  | { readonly kind: 'configure'; readonly supportedFeatures: number }
  | { readonly kind: 'setActive' }
  | { readonly kind: 'pingRequest'; readonly val1: number }
  | { readonly kind: 'start'; readonly started: boolean }
  | { readonly kind: 'error' }
  | { readonly kind: 'ignored' };

export const negotiateFeatures = (supported: number): number => WANTED_FEATURES & supported;

export const encodeKeyInject = (keyCode: number, direction: KeyDirection): Uint8Array => {
  if (!Number.isInteger(keyCode) || keyCode < 0 || keyCode > MAX_KEY_CODE) throw new RangeError('keyCode inválido');
  return lengthDelimitedField(
    Field.KeyInject,
    concatBytes(varintField(1, keyCode), varintField(2, DIRECTION[direction])),
  );
};

export const encodeAppLinkLaunch = (appLink: string): Uint8Array => {
  if (appLink.length === 0 || appLink.length > MAX_APP_LINK_LENGTH) throw new RangeError('appLink inválido');
  return lengthDelimitedField(Field.AppLinkLaunch, stringField(1, appLink));
};

export const encodePingResponse = (val1: number): Uint8Array => lengthDelimitedField(Field.PingResponse, varintField(1, val1));

export const encodeSetActive = (features: number): Uint8Array => lengthDelimitedField(Field.SetActive, varintField(1, features));

export const encodeRemoteConfigure = (features: number): Uint8Array => {
  const deviceInfo = concatBytes(
    varintField(3, 1),
    stringField(4, '1'),
    stringField(5, CLIENT_PACKAGE_NAME),
    stringField(6, CLIENT_APP_VERSION),
  );
  return lengthDelimitedField(Field.Configure, concatBytes(varintField(1, features), lengthDelimitedField(2, deviceInfo)));
};

const nestedFields = (fields: readonly WireField[], number: number): Result<WireField[]> | undefined => {
  const nested = findBytes(fields, number);
  return nested ? parseFields(nested) : undefined;
};

const decodeKnown = (fields: readonly WireField[]): Result<RemoteEvent> | undefined => {
  const configure = nestedFields(fields, Field.Configure);
  if (configure) return configure.ok ? ok({ kind: 'configure', supportedFeatures: findVarint(configure.value, 1) ?? 0 }) : configure;

  const ping = nestedFields(fields, Field.PingRequest);
  if (ping) return ping.ok ? ok({ kind: 'pingRequest', val1: findVarint(ping.value, 1) ?? 0 }) : ping;

  const start = nestedFields(fields, Field.Start);
  if (start) return start.ok ? ok({ kind: 'start', started: (findVarint(start.value, 1) ?? 0) !== 0 }) : start;

  if (findBytes(fields, Field.SetActive)) return ok({ kind: 'setActive' });
  if (findBytes(fields, Field.Error)) return ok({ kind: 'error' });
  return undefined;
};

export const decodeRemoteMessage = (payload: Uint8Array): Result<RemoteEvent> => {
  const parsed = parseFields(payload);
  if (!parsed.ok) return parsed;
  return decodeKnown(parsed.value) ?? ok({ kind: 'ignored' });
};
