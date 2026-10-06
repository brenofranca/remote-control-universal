export const TvApp = {
  YouTube: 'YOUTUBE',
  Netflix: 'NETFLIX',
  PrimeVideo: 'PRIME_VIDEO',
  DisneyPlus: 'DISNEY_PLUS',
  Max: 'MAX',
  Globoplay: 'GLOBOPLAY',
  Spotify: 'SPOTIFY',
  YouTubeMusic: 'YOUTUBE_MUSIC',
} as const;

export type TvApp = (typeof TvApp)[keyof typeof TvApp];
