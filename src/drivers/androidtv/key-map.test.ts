import { RemoteKey } from '@/domain/remote-key';
import { ANDROID_KEY_CODES, toAndroidKeyCode } from './key-map';

describe('toAndroidKeyCode', () => {
  it('mapeia toda RemoteKey para um keycode', () => {
    for (const key of Object.values(RemoteKey)) {
      const result = toAndroidKeyCode(key);
      expect(result.ok).toBe(true);
    }
  });

  it('não deixa RemoteKey sem entrada na tabela', () => {
    expect(Object.keys(ANDROID_KEY_CODES).sort()).toEqual(Object.values(RemoteKey).slice().sort());
  });

  it('usa keycodes Android conhecidos', () => {
    expect(toAndroidKeyCode(RemoteKey.DpadUp)).toEqual({ ok: true, value: 19 });
    expect(toAndroidKeyCode(RemoteKey.Ok)).toEqual({ ok: true, value: 23 });
    expect(toAndroidKeyCode(RemoteKey.Home)).toEqual({ ok: true, value: 3 });
    expect(toAndroidKeyCode(RemoteKey.Digit0)).toEqual({ ok: true, value: 7 });
    expect(toAndroidKeyCode(RemoteKey.Digit9)).toEqual({ ok: true, value: 16 });
  });

  it('rejeita tecla desconhecida sem lançar exceção', () => {
    const result = toAndroidKeyCode('HACK' as RemoteKey);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_KEY');
  });

  it('não confunde chaves herdadas do prototype', () => {
    expect(toAndroidKeyCode('constructor' as RemoteKey).ok).toBe(false);
    expect(toAndroidKeyCode('__proto__' as RemoteKey).ok).toBe(false);
  });
});
