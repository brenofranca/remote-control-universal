export interface ClientIdentity {
  readonly certificatePem: string;
  readonly privateKeyPem: string;
}

export interface PeerCertificate {
  readonly modulusHex: string;
  readonly exponentHex: string;
}

/**
 * Contrato: a implementação deve guardar dados e fechamento recebidos antes do primeiro
 * `onData`/`onClose` e entregá-los quando o listener for registrado. A TV pode falar assim que o
 * TLS abre, e o cliente ainda precisa verificar o pin de forma assíncrona antes de escutar.
 */
export interface TlsConnection {
  write(data: Uint8Array): void;
  close(): void;
  getPeerCertificate(): Promise<PeerCertificate | null>;
  onData(listener: (chunk: Uint8Array) => void): void;
  onClose(listener: (error?: Error) => void): void;
}

export interface TlsConnectOptions {
  readonly host: string;
  readonly port: number;
  readonly identity: ClientIdentity;
}

export interface TlsConnector {
  connect(options: TlsConnectOptions): Promise<TlsConnection>;
}

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export type RandomBytes = (byteCount: number) => Uint8Array;
