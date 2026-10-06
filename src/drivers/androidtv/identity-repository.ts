import type { ClientIdentity, KeyValueStore } from './ports';

const CERTIFICATE_KEY = 'atv-client-certificate';
const PRIVATE_KEY_KEY = 'atv-client-private-key';

export class IdentityRepository {
  private pending: Promise<ClientIdentity> | null = null;

  constructor(
    private readonly store: KeyValueStore,
    private readonly generate: () => Promise<ClientIdentity>,
  ) {}

  // Compartilha a promessa em andamento: gerar RSA é caro e duas gerações simultâneas gravariam identidades diferentes.
  load(): Promise<ClientIdentity> {
    this.pending ??= this.loadOrCreate().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async loadOrCreate(): Promise<ClientIdentity> {
    const [certificatePem, privateKeyPem] = await Promise.all([this.store.get(CERTIFICATE_KEY), this.store.get(PRIVATE_KEY_KEY)]);
    if (certificatePem && privateKeyPem) return { certificatePem, privateKeyPem };

    const identity = await this.generate();
    await this.store.set(PRIVATE_KEY_KEY, identity.privateKeyPem);
    await this.store.set(CERTIFICATE_KEY, identity.certificatePem);
    return identity;
  }
}
