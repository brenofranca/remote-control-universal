import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { TvApp } from '@/domain/tv-app';
import { Icon, type IconName } from './icon';

const SHORTCUTS: readonly { readonly app: TvApp; readonly label: string; readonly icon: IconName; readonly className: string }[] = [
  { app: TvApp.YouTube, label: 'YouTube', icon: 'video', className: 'bg-red-600' },
  { app: TvApp.Netflix, label: 'Netflix', icon: 'film', className: 'bg-neutral-900 dark:bg-neutral-800' },
  { app: TvApp.PrimeVideo, label: 'Prime Video', icon: 'liveTv', className: 'bg-sky-600' },
  { app: TvApp.DisneyPlus, label: 'Disney+', icon: 'sparkles', className: 'bg-blue-900' },
  { app: TvApp.Max, label: 'Max', icon: 'theater', className: 'bg-indigo-700' },
  { app: TvApp.Globoplay, label: 'Globoplay', icon: 'globe', className: 'bg-orange-600' },
  { app: TvApp.Spotify, label: 'Spotify', icon: 'music', className: 'bg-green-600' },
  { app: TvApp.YouTubeMusic, label: 'YT Music', icon: 'headphones', className: 'bg-rose-700' },
];

export function AppShortcuts({ onLaunch }: { onLaunch: (app: TvApp) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4 px-6">
      {SHORTCUTS.map(({ app, label, icon, className }) => (
        <Pressable
          key={app}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${label}`}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLaunch(app);
          }}
          className="w-[72px] items-center gap-1.5 active:opacity-70"
        >
          <View className={`h-16 w-16 items-center justify-center rounded-2xl ${className}`}>
            <Icon name={icon} size={28} color="#FFFFFF" />
          </View>
          <Text numberOfLines={1} className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
