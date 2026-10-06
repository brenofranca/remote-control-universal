import { encodeFrame } from '../protocol/frame';
import { concatBytes, findBytes, lengthDelimitedField, parseFields, varintField } from '../protocol/wire';

const POLO_FIELDS = { pairingRequestAck: 11, options: 20, configurationAck: 31, secretAck: 41 } as const;

export const poloFromTv = (kind: keyof typeof POLO_FIELDS, status = 200): Uint8Array =>
  encodeFrame(
    concatBytes(varintField(1, 2), varintField(2, status), lengthDelimitedField(POLO_FIELDS[kind], new Uint8Array(0))),
  );

export const poloErrorFromTv = (status: number): Uint8Array =>
  encodeFrame(concatBytes(varintField(1, 2), varintField(2, status)));

export const remoteConfigureFromTv = (features: number): Uint8Array =>
  encodeFrame(lengthDelimitedField(1, varintField(1, features)));

export const remoteSetActiveFromTv = (): Uint8Array => encodeFrame(lengthDelimitedField(2, varintField(1, 1)));

export const remoteStartFromTv = (started: boolean): Uint8Array =>
  encodeFrame(lengthDelimitedField(40, started ? varintField(1, 1) : new Uint8Array(0)));

export const remotePingFromTv = (val1: number): Uint8Array => encodeFrame(lengthDelimitedField(8, varintField(1, val1)));

export const remoteErrorFromTv = (): Uint8Array => encodeFrame(lengthDelimitedField(3, new Uint8Array(0)));

const CLIENT_POLO_FIELDS: Readonly<Record<number, string>> = {
  10: 'pairingRequest',
  20: 'options',
  30: 'configuration',
  40: 'secret',
};

export const poloFieldSentByClient = (payload: Uint8Array): string => {
  const parsed = parseFields(payload);
  if (!parsed.ok) return 'invalid';
  const field = parsed.value.find((candidate) => candidate.number in CLIENT_POLO_FIELDS);
  return field ? CLIENT_POLO_FIELDS[field.number] : 'unknown';
};

export const secretSentByClient = (payload: Uint8Array): Uint8Array | undefined => {
  const parsed = parseFields(payload);
  if (!parsed.ok) return undefined;
  const outer = findBytes(parsed.value, 40);
  const inner = outer ? parseFields(outer) : undefined;
  return inner?.ok ? findBytes(inner.value, 1) : undefined;
};
