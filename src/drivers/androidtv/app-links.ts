import { domainError } from '@/domain/errors';
import { fail, ok, type Result } from '@/domain/result';
import { TvApp } from '@/domain/tv-app';

// `market://launch` pede à Play Store da TV que abra o app instalado pelo nome do pacote.
const launch = (packageName: string) => `market://launch?id=${packageName}`;

export const ANDROID_APP_LINKS: Readonly<Record<TvApp, string>> = {
  [TvApp.YouTube]: launch('com.google.android.youtube.tv'),
  [TvApp.Netflix]: launch('com.netflix.ninja'),
  [TvApp.PrimeVideo]: launch('com.amazon.amazonvideo.livingroom'),
  [TvApp.DisneyPlus]: launch('com.disney.disneyplus'),
  [TvApp.Max]: launch('com.wbd.stream'),
  [TvApp.Globoplay]: launch('com.globo.globotv'),
  [TvApp.Spotify]: launch('com.spotify.tv.android'),
  [TvApp.YouTubeMusic]: launch('com.google.android.youtube.tvmusic'),
};

export const toAndroidAppLink = (app: TvApp): Result<string> => {
  if (!Object.hasOwn(ANDROID_APP_LINKS, app)) return fail(domainError('UNSUPPORTED_APP', 'App não suportado por esta TV.'));
  return ok(ANDROID_APP_LINKS[app]);
};
