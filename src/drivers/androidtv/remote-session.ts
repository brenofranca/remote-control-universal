import { domainError, type DomainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { createRateLimiter, type RateLimiter } from '@/security/rate-limiter';
import { listenForMessages, openConnection, safeWrite } from './connect';
import { KEY_RATE_LIMIT, REMOTE_PORT, RESPONSE_TIMEOUT_MS } from './constants';
import { PinStore, toPin } from './pin';
import type { ClientIdentity, TlsConnection, TlsConnector } from './ports';
import { encodeFrame } from './protocol/frame';
import {
  decodeRemoteMessage,
  encodeAppLinkLaunch,
  encodeKeyInject,
  encodePingResponse,
  encodeRemoteConfigure,
  encodeSetActive,
  Feature,
  negotiateFeatures,
  type KeyDirection,
  type RemoteEvent,
} from './protocol/remote';

export interface RemoteDependencies {
  readonly connector: TlsConnector;
  readonly identity: ClientIdentity;
  readonly pins: PinStore;
  readonly responseTimeoutMs?: number;
  readonly keyLimiter?: RateLimiter;
}

export interface RemoteTarget {
  readonly id: string;
  readonly address: string;
}

const untrusted = (message: string) => fail(domainError('UNTRUSTED_DEVICE', message));

export class RemoteSession {
  private features = 0;
  private closed = false;
  private readonly closeListeners: ((error: DomainError) => void)[] = [];
  private resolveReady: (result: Result<void>) => void = () => undefined;
  private readonly ready = new Promise<Result<void>>((resolve) => {
    this.resolveReady = resolve;
  });

  private constructor(
    private readonly connection: TlsConnection,
    private readonly keyLimiter: RateLimiter,
  ) {}

  static async open(deps: RemoteDependencies, target: RemoteTarget): Promise<Result<RemoteSession>> {
    const opened = await openConnection(deps.connector, target.address, REMOTE_PORT, deps.identity);
    if (!opened.ok) return opened;

    const trusted = await RemoteSession.verifyPin(deps.pins, target.id, opened.value);
    if (!trusted.ok) {
      opened.value.close();
      return trusted;
    }

    const session = new RemoteSession(opened.value, deps.keyLimiter ?? createRateLimiter(KEY_RATE_LIMIT));
    listenForMessages(opened.value, decodeRemoteMessage, {
      onMessage: (event) => session.handle(event),
      onError: (error) => session.fail(error),
    });

    const started = await session.waitUntilReady(deps.responseTimeoutMs ?? RESPONSE_TIMEOUT_MS);
    if (started.ok) return ok(session);
    session.close();
    return started;
  }

  sendKey(keyCode: number, direction: KeyDirection = 'SHORT'): Result<void> {
    if (this.closed) return fail(domainError('NOT_CONNECTED', 'Sem conexão com a TV.'));
    if ((this.features & Feature.KEY) === 0) return fail(domainError('UNSUPPORTED_KEY', 'A TV não aceita teclas.'));
    if (!this.keyLimiter.tryAcquire()) return fail(domainError('RATE_LIMITED', 'Muitas teclas em sequência.'));
    return safeWrite(this.connection, encodeFrame(encodeKeyInject(keyCode, direction)));
  }

  launchAppLink(appLink: string): Result<void> {
    if (this.closed) return fail(domainError('NOT_CONNECTED', 'Sem conexão com a TV.'));
    if ((this.features & Feature.APP_LINK) === 0) return fail(domainError('UNSUPPORTED_APP', 'A TV não aceita abrir apps.'));
    if (!this.keyLimiter.tryAcquire()) return fail(domainError('RATE_LIMITED', 'Muitos comandos em sequência.'));
    return safeWrite(this.connection, encodeFrame(encodeAppLinkLaunch(appLink)));
  }

  onClosed(listener: (error: DomainError) => void): void {
    this.closeListeners.push(listener);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.connection.close();
  }

  private static async verifyPin(pins: PinStore, deviceId: string, connection: TlsConnection): Promise<Result<void>> {
    const [pinned, peer] = await Promise.all([pins.get(deviceId), connection.getPeerCertificate()]);
    if (!pinned) return untrusted('Esta TV ainda não foi pareada.');
    if (!peer) return untrusted('A TV não apresentou certificado.');
    return toPin(peer) === pinned ? ok(undefined) : untrusted('O certificado da TV mudou. Pareie novamente.');
  }

  private waitUntilReady(timeoutMs: number): Promise<Result<void>> {
    const timeout = new Promise<Result<void>>((resolve) =>
      setTimeout(() => resolve(fail(domainError('TIMEOUT', 'A TV não ficou pronta a tempo.'))), timeoutMs),
    );
    return Promise.race([this.ready, timeout]);
  }

  private handle(event: RemoteEvent): void {
    if (event.kind === 'configure') return this.answerConfigure(event.supportedFeatures);
    if (event.kind === 'setActive') return this.send(encodeSetActive(this.features));
    if (event.kind === 'pingRequest') return this.send(encodePingResponse(event.val1));
    if (event.kind === 'start') return this.resolveReady(ok(undefined));
    if (event.kind === 'error') this.fail(domainError('CONNECTION_FAILED', 'A TV reportou um erro.'));
  }

  private answerConfigure(supported: number): void {
    this.features = negotiateFeatures(supported);
    if ((this.features & Feature.KEY) === 0) {
      this.fail(domainError('UNSUPPORTED_KEY', 'A TV não aceita o envio de teclas.'));
      return;
    }
    this.send(encodeRemoteConfigure(this.features));
  }

  private send(payload: Uint8Array): void {
    const sent = safeWrite(this.connection, encodeFrame(payload));
    if (!sent.ok) this.fail(sent.error);
  }

  private fail(error: DomainError): void {
    this.resolveReady(fail(error));
    if (this.closed) return;
    this.close();
    this.closeListeners.forEach((listener) => listener(error));
  }
}
