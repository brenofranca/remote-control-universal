import { domainError, type DomainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { parsePrivateIPv4 } from '@/security/private-address';
import { MAX_FRAME_SIZE } from './constants';
import type { ClientIdentity, TlsConnection, TlsConnector } from './ports';
import { FrameDecoder } from './protocol/frame';

export const openConnection = async (
  connector: TlsConnector,
  address: string,
  port: number,
  identity: ClientIdentity,
): Promise<Result<TlsConnection>> => {
  const host = parsePrivateIPv4(address);
  if (!host.ok) return host;
  try {
    return ok(await connector.connect({ host: host.value, port, identity }));
  } catch {
    return fail(domainError('CONNECTION_FAILED', 'Não foi possível conectar à TV.'));
  }
};

export const safeWrite = (connection: TlsConnection, data: Uint8Array): Result<void> => {
  try {
    connection.write(data);
    return ok(undefined);
  } catch {
    return fail(domainError('CONNECTION_FAILED', 'A conexão com a TV foi encerrada.'));
  }
};

export interface MessageHandlers<T> {
  onMessage(message: T): void;
  onError(error: DomainError): void;
}

export const listenForMessages = <T>(
  connection: TlsConnection,
  decode: (payload: Uint8Array) => Result<T>,
  handlers: MessageHandlers<T>,
): void => {
  const decoder = new FrameDecoder(MAX_FRAME_SIZE);
  connection.onData((chunk) => {
    const frames = decoder.push(chunk);
    if (!frames.ok) return handlers.onError(frames.error);
    for (const frame of frames.value) {
      const message = decode(frame);
      if (!message.ok) return handlers.onError(message.error);
      handlers.onMessage(message.value);
    }
  });
  connection.onClose(() => handlers.onError(domainError('CONNECTION_FAILED', 'A conexão com a TV foi encerrada.')));
};
