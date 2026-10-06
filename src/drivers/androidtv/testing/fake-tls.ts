import type { PeerCertificate, TlsConnection, TlsConnector, TlsConnectOptions } from '../ports';
import { FrameDecoder } from '../protocol/frame';

export type Responder = (payload: Uint8Array) => Uint8Array[];

export class FakeTlsConnection implements TlsConnection {
  readonly payloads: Uint8Array[] = [];
  closed = false;
  private readonly decoder = new FrameDecoder(1024 * 1024);
  private readonly dataListeners: ((chunk: Uint8Array) => void)[] = [];
  private readonly closeListeners: ((error?: Error) => void)[] = [];
  private readonly bufferedData: Uint8Array[] = [];
  private bufferedClose: { error?: Error } | null = null;

  constructor(
    private readonly peer: PeerCertificate | null,
    private readonly respond: Responder = () => [],
  ) {}

  write(data: Uint8Array): void {
    if (this.closed) throw new Error('socket fechado');
    const frames = this.decoder.push(data);
    if (!frames.ok) throw new Error('frame inválido escrito pelo cliente');
    for (const payload of frames.value) {
      this.payloads.push(payload);
      this.respond(payload).forEach((reply) => this.emit(reply));
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.closeListeners.length === 0) this.bufferedClose = {};
    this.closeListeners.forEach((listener) => listener());
  }

  getPeerCertificate = async () => this.peer;
  onData = (listener: (chunk: Uint8Array) => void) => {
    this.dataListeners.push(listener);
    this.bufferedData.splice(0).forEach((chunk) => listener(chunk));
  };

  onClose = (listener: (error?: Error) => void) => {
    this.closeListeners.push(listener);
    if (this.bufferedClose) listener(this.bufferedClose.error);
  };

  emit(chunk: Uint8Array): void {
    if (this.dataListeners.length === 0) this.bufferedData.push(chunk);
    this.dataListeners.forEach((listener) => listener(chunk));
  }

  drop(error?: Error): void {
    this.closed = true;
    if (this.closeListeners.length === 0) this.bufferedClose = { error };
    this.closeListeners.forEach((listener) => listener(error));
  }
}

export class FakeConnector implements TlsConnector {
  readonly requests: TlsConnectOptions[] = [];

  constructor(private readonly connections: FakeTlsConnection[] | Error) {}

  async connect(options: TlsConnectOptions): Promise<FakeTlsConnection> {
    this.requests.push(options);
    if (this.connections instanceof Error) throw this.connections;
    const next = this.connections.shift();
    if (!next) throw new Error('sem conexão configurada');
    return next;
  }
}
