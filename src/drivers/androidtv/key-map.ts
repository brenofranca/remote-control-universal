import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { RemoteKey } from '@/domain/remote-key';

export const ANDROID_KEY_CODES: Readonly<Record<RemoteKey, number>> = {
  [RemoteKey.DpadUp]: 19,
  [RemoteKey.DpadDown]: 20,
  [RemoteKey.DpadLeft]: 21,
  [RemoteKey.DpadRight]: 22,
  [RemoteKey.Ok]: 23,
  [RemoteKey.Back]: 4,
  [RemoteKey.Home]: 3,
  [RemoteKey.Power]: 26,
  [RemoteKey.VolumeUp]: 24,
  [RemoteKey.VolumeDown]: 25,
  [RemoteKey.Mute]: 164,
  [RemoteKey.ChannelUp]: 166,
  [RemoteKey.ChannelDown]: 167,
  [RemoteKey.PlayPause]: 85,
  [RemoteKey.Rewind]: 89,
  [RemoteKey.FastForward]: 90,
  [RemoteKey.Digit0]: 7,
  [RemoteKey.Digit1]: 8,
  [RemoteKey.Digit2]: 9,
  [RemoteKey.Digit3]: 10,
  [RemoteKey.Digit4]: 11,
  [RemoteKey.Digit5]: 12,
  [RemoteKey.Digit6]: 13,
  [RemoteKey.Digit7]: 14,
  [RemoteKey.Digit8]: 15,
  [RemoteKey.Digit9]: 16,
};

export const toAndroidKeyCode = (key: RemoteKey): Result<number> => {
  if (!Object.hasOwn(ANDROID_KEY_CODES, key)) {
    return fail(domainError('UNSUPPORTED_KEY', 'Tecla não suportada por esta TV.'));
  }
  return ok(ANDROID_KEY_CODES[key]);
};
