import type { Result } from './result';
import type { RemoteKey } from './remote-key';
import type { TvApp } from './tv-app';
import type { TvDevice } from './tv-device';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface TvDriver {
  readonly status: ConnectionStatus;
  connect(device: TvDevice): Promise<Result<void>>;
  disconnect(): Promise<void>;
  sendKey(key: RemoteKey): Promise<Result<void>>;
  launchApp(app: TvApp): Promise<Result<void>>;
}
