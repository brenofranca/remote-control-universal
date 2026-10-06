import { TvApp } from '@/domain/tv-app';
import { ANDROID_APP_LINKS, toAndroidAppLink } from './app-links';

describe('toAndroidAppLink', () => {
  it('tem link para todo TvApp', () => {
    expect(Object.keys(ANDROID_APP_LINKS).sort()).toEqual(Object.values(TvApp).slice().sort());
  });

  it('abre o app pelo pacote via Play Store', () => {
    expect(toAndroidAppLink(TvApp.Netflix)).toEqual({ ok: true, value: 'market://launch?id=com.netflix.ninja' });
  });

  it('rejeita app desconhecido e chaves do prototype', () => {
    for (const app of ['HACK', 'toString', '__proto__'] as unknown as TvApp[]) {
      const result = toAndroidAppLink(app);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_APP');
    }
  });
});
