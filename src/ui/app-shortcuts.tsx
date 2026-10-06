import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, Text } from 'react-native';
import { TvApp } from '@/domain/tv-app';

const SHORTCUTS: readonly { readonly app: TvApp; readonly label: string; readonly className: string }[] = [
  { app: TvApp.YouTube, label: 'YouTube', className: 'bg-red-600 active:bg-red-700' },
  { app: TvApp.Netflix, label: 'Netflix', className: 'bg-neutral-900 active:bg-neutral-700 dark:bg-neutral-800' },
  { app: TvApp.PrimeVideo, label: 'Prime Video', className: 'bg-sky-600 active:bg-sky-700' },
  { app: TvApp.DisneyPlus, label: 'Disney+', className: 'bg-blue-900 active:bg-blue-950' },
  { app: TvApp.Max, label: 'Max', className: 'bg-indigo-700 active:bg-indigo-800' },
  { app: TvApp.Globoplay, label: 'Globoplay', className: 'bg-orange-600 active:bg-orange-700' },
  { app: TvApp.Spotify, label: 'Spotify', className: 'bg-green-600 active:bg-green-700' },
  { app: TvApp.YouTubeMusic, label: 'YT Music', className: 'bg-rose-700 active:bg-rose-800' },
];

export function AppShortcuts({ onLaunch }: { onLaunch: (app: TvApp) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-6">
      {SHORTCUTS.map(({ app, label, className }) => (
        <Pressable
          key={app}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${label}`}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLaunch(app);
          }}
          className={`min-h-12 items-center justify-center rounded-2xl px-5 ${className}`}
        >
          <Text className="text-base font-semibold text-white">{label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
