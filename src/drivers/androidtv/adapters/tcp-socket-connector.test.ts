import type { ClientIdentity } from '../ports';
import { createTcpSocketConnector, type RawPeerCertificate, type TlsSocketApi, type TlsSocketLike } from './tcp-socket-connector';

const IDENTITY: ClientIdentity = { certificatePem: 'CERT', privateKeyPem: 'KEY' };
const OPTIONS = { host: '192.168.0.50', port: 6466, identity: IDENTITY };

class FakeSocket implements TlsSocketLike {
  readonly written: Uint8Array[] = [];
  destroyed = false;
  peer: RawPeerCertificate | null = null;
  peerError: Error | null = null;
  private readonly listeners: Record<string, ((arg: never) => void)[]> = {};

  on(event: 'data', listener: (data: Uint8Array | string) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: () => void): this;
  on(event: string, listener: (arg: never) => void): this {
    (this.listeners[event] ??= []).push(listener);
    return this;
  }
  write(data: Uint8Array): void {
    this.written.push(data);
  }
  destroy(): void {
    this.destroyed = true;
  }
  async getPeerCertificate(): Promise<RawPeerCertificate | null> {
    if (this.peerError) throw this.peerError;
    return this.peer;
  }
  fire(event: string, arg?: unknown): void {
    (this.listeners[event] ?? []).forEach((listener) => listener(arg as never));
  }
}

const setup = () => {
  const socket = new FakeSocket();
  let onSecureConnect: () => void = () => undefined;
  const connectTLS = jest.fn((_options: unknown, callback: () => void) => {
    onSecureConnect = callback;
    return socket;
  });
  const api: TlsSocketApi = { connectTLS };
  return { socket, connectTLS, secureConnect: () => onSecureConnect(), connector: createTcpSocketConnector(api, 50) };
};

describe('createTcpSocketConnector', () => {
  it('conecta com a identidade do cliente e sem validar a cadeia (autoassinado)', async () => {
    const { connector, connectTLS, secureConnect } = setup();
    const pending = connector.connect(OPTIONS);
    secureConnect();
    await pending;

    expect(connectTLS.mock.calls[0][0]).toEqual({
      host: OPTIONS.host,
      port: OPTIONS.port,
      key: 'KEY',
      cert: 'CERT',
      rejectUnauthorized: false,
    });
  });

  it('rejeita se o socket emitir erro antes de conectar', async () => {
    const { connector, socket } = setup();
    const pending = connector.connect(OPTIONS);
    socket.fire('error', new Error('recusado'));
    await expect(pending).rejects.toThrow('recusado');
  });

  it('rejeita e destrói o socket no timeout de conexão', async () => {
    const { connector, socket } = setup();
    await expect(connector.connect(OPTIONS)).rejects.toThrow('Tempo esgotado');
    expect(socket.destroyed).toBe(true);
  });

  it('guarda dados recebidos antes do primeiro listener e entrega depois', async () => {
    const { connector, socket, secureConnect } = setup();
    const pending = connector.connect(OPTIONS);
    secureConnect();
    const connection = await pending;
    socket.fire('data', new Uint8Array([1, 2]));
    socket.fire('data', new Uint8Array([3]));

    const received: number[][] = [];
    connection.onData((chunk) => received.push(Array.from(chunk)));
    socket.fire('data', new Uint8Array([4]));

    expect(received).toEqual([[1, 2], [3], [4]]);
  });

  it('entrega o fechamento que ocorreu antes do listener, com o último erro', async () => {
    const { connector, socket, secureConnect } = setup();
    const pending = connector.connect(OPTIONS);
    secureConnect();
    const connection = await pending;
    socket.fire('error', new Error('reset'));
    socket.fire('close');

    const onClose = jest.fn();
    connection.onClose(onClose);
    expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ message: 'reset' }));
  });

  it('notifica fechamento uma única vez', async () => {
    const { connector, socket, secureConnect } = setup();
    const pending = connector.connect(OPTIONS);
    secureConnect();
    const connection = await pending;
    const onClose = jest.fn();
    connection.onClose(onClose);

    socket.fire('close');
    socket.fire('close');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('converte dados para Uint8Array independente do buffer original', async () => {
    const { connector, socket, secureConnect } = setup();
    const pending = connector.connect(OPTIONS);
    secureConnect();
    const connection = await pending;
    const original = new Uint8Array([9, 9]);
    const received: Uint8Array[] = [];
    connection.onData((chunk) => received.push(chunk));

    socket.fire('data', original);
    original[0] = 0;

    expect(Array.from(received[0])).toEqual([9, 9]);
  });

  it('escreve e fecha pelo socket', async () => {
    const { connector, socket, secureConnect } = setup();
    const pending = connector.connect(OPTIONS);
    secureConnect();
    const connection = await pending;

    connection.write(new Uint8Array([7]));
    connection.close();

    expect(socket.written).toEqual([new Uint8Array([7])]);
    expect(socket.destroyed).toBe(true);
  });

  describe('getPeerCertificate', () => {
    const connected = async (peer: RawPeerCertificate | null, peerError: Error | null = null) => {
      const { connector, socket, secureConnect } = setup();
      socket.peer = peer;
      socket.peerError = peerError;
      const pending = connector.connect(OPTIONS);
      secureConnect();
      return pending;
    };

    it('normaliza o expoente com prefixo 0x', async () => {
      const connection = await connected({ modulus: 'ABCDEF', exponent: '0x10001' });
      expect(await connection.getPeerCertificate()).toEqual({ modulusHex: 'ABCDEF', exponentHex: '10001' });
    });

    it.each([
      [null],
      [{}],
      [{ modulus: 'ABCD' }],
      [{ modulus: 'ZZ', exponent: '10001' }],
      [{ modulus: 'ABCD', exponent: 65537 }],
      [{ modulus: '', exponent: '10001' }],
    ])('devolve null para certificado ausente ou malformado %j', async (raw) => {
      const connection = await connected(raw as RawPeerCertificate | null);
      expect(await connection.getPeerCertificate()).toBeNull();
    });

    it('devolve null se a leitura do certificado falhar', async () => {
      const connection = await connected(null, new Error('sem trust'));
      expect(await connection.getPeerCertificate()).toBeNull();
    });
  });
});
