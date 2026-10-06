import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useColorScheme } from 'react-native';

export const ICONS = {
  up: { ios: 'chevron.up', android: 'keyboard_arrow_up' },
  down: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  left: { ios: 'chevron.left', android: 'keyboard_arrow_left' },
  right: { ios: 'chevron.right', android: 'keyboard_arrow_right' },
  back: { ios: 'arrow.uturn.backward', android: 'undo' },
  home: { ios: 'house.fill', android: 'home' },
  power: { ios: 'power', android: 'power_settings_new' },
  plus: { ios: 'plus', android: 'add' },
  minus: { ios: 'minus', android: 'remove' },
  mute: { ios: 'speaker.slash.fill', android: 'volume_off' },
  playPause: { ios: 'playpause.fill', android: 'play_pause' },
  rewind: { ios: 'backward.fill', android: 'fast_rewind' },
  forward: { ios: 'forward.fill', android: 'fast_forward' },
  dialpad: { ios: 'circle.grid.3x3.fill', android: 'dialpad' },
  tv: { ios: 'tv', android: 'tv' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh' },
  close: { ios: 'xmark', android: 'close' },
  switchTv: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  video: { ios: 'play.rectangle.fill', android: 'smart_display' },
  film: { ios: 'film.fill', android: 'movie' },
  liveTv: { ios: 'play.tv.fill', android: 'live_tv' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  theater: { ios: 'theatermasks.fill', android: 'theater_comedy' },
  globe: { ios: 'globe.americas.fill', android: 'public' },
  music: { ios: 'music.note', android: 'music_note' },
  headphones: { ios: 'headphones', android: 'headphones' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export const useForeground = () => (useColorScheme() === 'dark' ? '#F4F4F5' : '#18181B');

export function Icon({ name, size = 24, color }: { name: IconName; size?: number; color?: string }) {
  const foreground = useForeground();
  return <SymbolView name={{ ...ICONS[name], web: ICONS[name].android }} size={size} tintColor={color ?? foreground} />;
}
