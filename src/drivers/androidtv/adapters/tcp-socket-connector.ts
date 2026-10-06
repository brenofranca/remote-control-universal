import type { PeerCertificate, TlsConnection, TlsConnector, TlsConnectOptions } from '../ports';

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const HEX_PATTERN = /^[0-9a-fA-F]+$/;
const HEX_PREFIX = /^0x/i;

export interface RawPeerCertificate {
  readonly modulus?: unknown;
  readonly exponent?: unknown;
}

export interface TlsSocketLike {
  on(event: 'data', listener: (data: Uint8Array | string) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  write(data: Uint8Array): unknown;
  destroy(): void;
  getPeerCertificate(): Promise<RawPeerCertificate | null>;
}

export interface TlsSocketApi {
  connectTLS(
    options: {
      readonly host: string;
      readonly port: number;
      readonly key: string;
      readonly cert: string;
      readonly rejectUnauthorized: boolean;
    },
    onSecureConnect: () => void,
  ): TlsSocketLike;
}

const toHex = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const hex = value.replace(HEX_PREFIX, '');
  return HEX_PATTERN.test(hex) ? hex : null;
};

const toPeerCertificate = (raw: RawPeerCertificate | null): PeerCertificate | null => {
  const modulusHex = toHex(raw?.modulus);
  const exponentHex = toHex(raw?.exponent);
  return modulusHex && exponentHex ? { modulusHex, exponentHex } : null;
};

const toBytes = (data: Uint8Array | string): Uint8Array =>
  typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);

// Guarda dados e fechamento recebidos antes do primeiro listener (contrato de TlsConnection).
class BufferedConnection implements TlsConnection {
  private readonly dataListeners: ((chunk: Uint8Array) => void)[] = [];
  private readonly closeListeners: ((error?: Error) => void)[] = [];
  private readonly bufferedData: Uint8Array[] = [];
  private closedWith: { error?: Error } | null = null;
  private lastError: Error | undefined;

  constructor(private readonly socket: TlsSocketLike) {
    socket.on('data', (data) => this.receive(toBytes(data)));
    socket.on('error', (error) => {
      this.lastError = error;
    });
    socket.on('close', () => this.finish(this.lastError));
  }

  write(data: Uint8Array): void {
    this.socket.write(data);
  }

  close(): void {
    this.socket.destroy();
  }

  async getPeerCertificate(): Promise<PeerCertificate | null> {
    try {
      return toPeerCertificate(await this.socket.getPeerCertificate());
    } catch {
      return null;
    }
  }

  onData(listener: (chunk: Uint8Array) => void): void {
    this.dataListeners.push(listener);
    this.bufferedData.splice(0).forEach(listener);
  }

  onClose(listener: (error?: Error) => void): void {
    this.closeListeners.push(listener);
    if (this.closedWith) listener(this.closedWith.error);
  }

  private receive(chunk: Uint8Array): void {
    if (this.dataListeners.length === 0) this.bufferedData.push(chunk);
    this.dataListeners.forEach((listener) => listener(chunk));
  }

  private finish(error?: Error): void {
    if (this.closedWith) return;
    this.closedWith = { error };
    this.closeListeners.forEach((listener) => listener(error));
  }
}

export const createTcpSocketConnector = (api: TlsSocketApi, connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS): TlsConnector => ({
  connect: ({ host, port, identity }: TlsConnectOptions) =>
    new Promise<TlsConnection>((resolve, reject) => {
      // A TV usa certificado autoassinado, então a cadeia não é validada aqui.
      // A autenticação da TV é feita por pin do certificado (PinStore), verificado antes de qualquer comando.
      const socket = api.connectTLS(
        { host, port, key: identity.privateKeyPem, cert: identity.certificatePem, rejectUnauthorized: false },
        () => {
          clearTimeout(timer);
          resolve(connection);
        },
      );
      const connection = new BufferedConnection(socket);
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error('Tempo esgotado ao conectar.'));
      }, connectTimeoutMs);
      socket.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    }),
});
