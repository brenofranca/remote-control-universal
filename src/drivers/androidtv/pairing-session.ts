import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { readPublicKeyHex } from './certificate';
import { listenForMessages, openConnection, safeWrite } from './connect';
import { PAIRING_PORT, RESPONSE_TIMEOUT_MS } from './constants';
import { MessageChannel } from './message-channel';
import { PinStore, toPin } from './pin';
import type { ClientIdentity, PeerCertificate, TlsConnection, TlsConnector } from './ports';
import { computePairingSecret, type Sha256 } from './protocol/pairing-secret';
import { encodeFrame } from './protocol/frame';
import {
  decodePoloMessage,
  encodeConfiguration,
  encodeOptions,
  encodePairingRequest,
  encodeSecret,
  type PoloMessage,
} from './protocol/polo';

export interface PairingDependencies {
  readonly connector: TlsConnector;
  readonly identity: ClientIdentity;
  readonly sha256: Sha256;
  readonly pins: PinStore;
  readonly responseTimeoutMs?: number;
}

export interface PairingTarget {
  readonly id: string;
  readonly address: string;
}

export class PairingSession {
  private finished = false;

  private constructor(
    private readonly connection: TlsConnection,
    private readonly channel: MessageChannel<PoloMessage>,
    private readonly target: PairingTarget,
    private readonly deps: PairingDependencies,
  ) {}

  static async begin(
    deps: PairingDependencies,
    target: PairingTarget,
    clientName: string,
  ): Promise<Result<PairingSession>> {
    const opened = await openConnection(deps.connector, target.address, PAIRING_PORT, deps.identity);
    if (!opened.ok) return opened;

    const channel = new MessageChannel<PoloMessage>();
    listenForMessages(opened.value, decodePoloMessage, {
      onMessage: (message) => channel.push(message),
      onError: (error) => channel.close(error),
    });

    const session = new PairingSession(opened.value, channel, target, deps);
    const handshake = await session.runHandshake(clientName);
    if (handshake.ok) return ok(session);
    session.cancel();
    return handshake;
  }

  async submitCode(code: string): Promise<Result<void>> {
    if (this.finished) return fail(domainError('PAIRING_FAILED', 'O pareamento já foi encerrado.'));

    const proof = await this.buildProof(code);
    if (!proof.ok) return proof;

    this.finished = true;
    const sent = safeWrite(this.connection, encodeFrame(encodeSecret(proof.value.secret)));
    const confirmed = sent.ok ? await this.expect('secretAck') : sent;
    this.connection.close();
    if (!confirmed.ok) return confirmed;

    await this.deps.pins.save(this.target.id, toPin(proof.value.server));
    return ok(undefined);
  }

  cancel(): void {
    this.finished = true;
    this.connection.close();
  }

  private async buildProof(code: string): Promise<Result<{ secret: Uint8Array; server: PeerCertificate }>> {
    const server = await this.connection.getPeerCertificate();
    if (!server) return fail(domainError('PAIRING_FAILED', 'A TV não apresentou certificado.'));
    const client = readPublicKeyHex(this.deps.identity.certificatePem);
    if (!client.ok) return client;

    const secret = computePairingSecret({
      clientModulusHex: client.value.modulusHex,
      clientExponentHex: client.value.exponentHex,
      serverModulusHex: server.modulusHex,
      serverExponentHex: server.exponentHex,
      code,
      sha256: this.deps.sha256,
    });
    return secret.ok ? ok({ secret: secret.value, server }) : secret;
  }

  private async runHandshake(clientName: string): Promise<Result<void>> {
    const steps: readonly (readonly [Uint8Array, PoloMessage['kind']])[] = [
      [encodePairingRequest(clientName), 'pairingRequestAck'],
      [encodeOptions(), 'options'],
      [encodeConfiguration(), 'configurationAck'],
    ];
    for (const [message, expected] of steps) {
      const sent = safeWrite(this.connection, encodeFrame(message));
      if (!sent.ok) return sent;
      const reply = await this.expect(expected);
      if (!reply.ok) return reply;
    }
    return ok(undefined);
  }

  private async expect(kind: PoloMessage['kind']): Promise<Result<void>> {
    const message = await this.channel.next(this.deps.responseTimeoutMs ?? RESPONSE_TIMEOUT_MS);
    if (!message.ok) return message;
    if (message.value.kind !== kind) return fail(domainError('PROTOCOL_ERROR', 'Resposta inesperada da TV.'));
    return ok(undefined);
  }
}
