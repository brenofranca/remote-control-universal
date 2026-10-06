import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import type { RemoteKey } from '@/domain/remote-key';
import type { TvDevice } from '@/domain/tv-device';
import type { ConnectionStatus, TvDriver } from '@/domain/tv-driver';
import { CLIENT_DISPLAY_NAME } from './constants';
import type { IdentityRepository } from './identity-repository';
import { toAndroidKeyCode } from './key-map';
import { PairingSession } from './pairing-session';
import type { PinStore } from './pin';
import type { ClientIdentity, TlsConnector } from './ports';
import type { Sha256 } from './protocol/pairing-secret';
import { RemoteSession } from './remote-session';

export interface AndroidTvDriverDependencies {
  readonly connector: TlsConnector;
  readonly identities: IdentityRepository;
  readonly pins: PinStore;
  readonly sha256: Sha256;
  readonly clientName?: string;
}

export class AndroidTvDriver implements TvDriver {
  private session: RemoteSession | null = null;
  private currentStatus: ConnectionStatus = 'disconnected';
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();

  constructor(private readonly deps: AndroidTvDriverDependencies) {}

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async isPaired(device: TvDevice): Promise<boolean> {
    return (await this.deps.pins.get(device.id)) !== null;
  }

  async connect(device: TvDevice): Promise<Result<void>> {
    if (this.currentStatus === 'connecting') return fail(domainError('CONNECTION_FAILED', 'Já existe uma conexão em andamento.'));
    this.setStatus('connecting');
    this.closeCurrentSession();

    const identity = await this.loadIdentity();
    const opened = identity.ok
      ? await RemoteSession.open({ connector: this.deps.connector, identity: identity.value, pins: this.deps.pins }, device)
      : identity;
    if (!opened.ok) {
      this.setStatus('disconnected');
      return opened;
    }

    this.session = opened.value;
    this.setStatus('connected');
    opened.value.onClosed(() => this.handleSessionClosed(opened.value));
    return ok(undefined);
  }

  async disconnect(): Promise<void> {
    this.closeCurrentSession();
    this.setStatus('disconnected');
  }

  async sendKey(key: RemoteKey): Promise<Result<void>> {
    if (!this.session) return fail(domainError('NOT_CONNECTED', 'Sem conexão com a TV.'));
    const keyCode = toAndroidKeyCode(key);
    if (!keyCode.ok) return keyCode;
    return this.session.sendKey(keyCode.value);
  }

  async beginPairing(device: TvDevice): Promise<Result<PairingSession>> {
    const identity = await this.loadIdentity();
    if (!identity.ok) return identity;
    return PairingSession.begin(
      { connector: this.deps.connector, identity: identity.value, sha256: this.deps.sha256, pins: this.deps.pins },
      device,
      this.deps.clientName ?? CLIENT_DISPLAY_NAME,
    );
  }

  private closeCurrentSession(): void {
    const session = this.session;
    this.session = null;
    session?.close();
  }

  private async loadIdentity(): Promise<Result<ClientIdentity>> {
    try {
      return ok(await this.deps.identities.load());
    } catch {
      return fail(domainError('CONNECTION_FAILED', 'Não foi possível carregar a identidade do aplicativo.'));
    }
  }

  private handleSessionClosed(closed: RemoteSession): void {
    if (this.session !== closed) return;
    this.session = null;
    this.setStatus('disconnected');
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}
