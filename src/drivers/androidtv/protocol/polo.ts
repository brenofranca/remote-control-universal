import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { concatBytes, findVarint, lengthDelimitedField, parseFields, stringField, varintField, type WireField } from './wire';

const PROTOCOL_VERSION = 2;
const STATUS_OK = 200;
const SERVICE_NAME = 'atvremote';
const ENCODING_HEXADECIMAL = 3;
const CODE_SYMBOL_LENGTH = 6;
const ROLE_INPUT = 1;

const OuterField = {
  ProtocolVersion: 1,
  Status: 2,
  PairingRequest: 10,
  PairingRequestAck: 11,
  Options: 20,
  Configuration: 30,
  ConfigurationAck: 31,
  Secret: 40,
  SecretAck: 41,
} as const;

export type PoloMessage =
  | { readonly kind: 'pairingRequestAck' }
  | { readonly kind: 'options' }
  | { readonly kind: 'configurationAck' }
  | { readonly kind: 'secretAck' };

const outer = (body: Uint8Array): Uint8Array =>
  concatBytes(varintField(OuterField.ProtocolVersion, PROTOCOL_VERSION), varintField(OuterField.Status, STATUS_OK), body);

const hexadecimalEncoding = (): Uint8Array =>
  concatBytes(varintField(1, ENCODING_HEXADECIMAL), varintField(2, CODE_SYMBOL_LENGTH));

export const encodePairingRequest = (clientName: string): Uint8Array =>
  outer(lengthDelimitedField(OuterField.PairingRequest, concatBytes(stringField(1, SERVICE_NAME), stringField(2, clientName))));

export const encodeOptions = (): Uint8Array =>
  outer(
    lengthDelimitedField(OuterField.Options, concatBytes(lengthDelimitedField(1, hexadecimalEncoding()), varintField(3, ROLE_INPUT))),
  );

export const encodeConfiguration = (): Uint8Array =>
  outer(
    lengthDelimitedField(
      OuterField.Configuration,
      concatBytes(lengthDelimitedField(1, hexadecimalEncoding()), varintField(2, ROLE_INPUT)),
    ),
  );

export const encodeSecret = (secret: Uint8Array): Uint8Array =>
  outer(lengthDelimitedField(OuterField.Secret, lengthDelimitedField(1, secret)));

const MESSAGE_KINDS: readonly (readonly [number, PoloMessage['kind']])[] = [
  [OuterField.PairingRequestAck, 'pairingRequestAck'],
  [OuterField.Options, 'options'],
  [OuterField.ConfigurationAck, 'configurationAck'],
  [OuterField.SecretAck, 'secretAck'],
];

const hasField = (fields: readonly WireField[], number: number) => fields.some((field) => field.number === number);

export const decodePoloMessage = (payload: Uint8Array): Result<PoloMessage> => {
  const parsed = parseFields(payload);
  if (!parsed.ok) return parsed;

  const status = findVarint(parsed.value, OuterField.Status);
  if (status === undefined) return fail(domainError('PROTOCOL_ERROR', 'Mensagem de pareamento sem status.'));
  if (status !== STATUS_OK) return fail(domainError('PAIRING_FAILED', 'A TV recusou o pareamento.'));

  const match = MESSAGE_KINDS.find(([field]) => hasField(parsed.value, field));
  if (!match) return fail(domainError('PROTOCOL_ERROR', 'Mensagem de pareamento não reconhecida.'));
  return ok({ kind: match[1] });
};
