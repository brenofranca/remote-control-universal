import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RemoteKey } from '@/domain/remote-key';
import type { TvApp } from '@/domain/tv-app';
import { remoteStore, useRemote } from '@/state/remote';
import { AppShortcuts } from '@/ui/app-shortcuts';
import { DPad } from '@/ui/dpad';
import { NumberPad } from '@/ui/number-pad';
import { RemoteButton } from '@/ui/remote-button';

const STATUS_LABEL = { connected: 'Conectado', connecting: 'Conectando…', disconnected: 'Desconectado' } as const;
const STATUS_DOT = { connected: 'bg-green-500', connecting: 'bg-amber-500', disconnected: 'bg-zinc-400' } as const;

export default function RemoteScreen() {
  const [numberPadOpen, setNumberPadOpen] = useState(false);
  const device = useRemote((state) => state.device);
  const status = useRemote((state) => state.status);
  const error = useRemote((state) => state.error);

  useEffect(() => {
    if (!device) {
      router.replace('/');
      return;
    }
    void remoteStore.getState().reconnect();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void remoteStore.getState().reconnect();
    });
    return () => subscription.remove();
  }, [device]);

  const send = useCallback((key: RemoteKey) => {
    void remoteStore.getState().sendKey(key);
  }, []);

  const launch = useCallback((app: TvApp) => {
    void remoteStore.getState().launchApp(app);
  }, []);

  const switchTv = async () => {
    await remoteStore.getState().switchTv();
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="flex-row items-center justify-between px-6 py-3">
        <View className="flex-1 gap-1">
          <Text numberOfLines={1} className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {device?.name ?? 'TV'}
          </Text>
          <View className="flex-row items-center gap-2">
            <View className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">{STATUS_LABEL[status]}</Text>
          </View>
        </View>
        <RemoteButton label="Trocar de TV" icon="switchTv" className="min-h-12 min-w-12" onPress={switchTv} />
      </View>

      {status !== 'connected' && (
        <Pressable
          accessibilityRole="button"
          onPress={() => remoteStore.getState().reconnect()}
          className="mx-6 flex-row items-center gap-3 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950"
        >
          {status === 'connecting' && <ActivityIndicator />}
          <Text className="flex-1 text-base text-amber-800 dark:text-amber-200">
            {status === 'connecting' ? 'Conectando à TV…' : `${error?.message ?? 'Sem conexão com a TV.'} Toque para reconectar.`}
          </Text>
        </Pressable>
      )}

      <ScrollView contentContainerClassName="gap-8 py-6">
        <AppShortcuts onLaunch={launch} />
        <View className="items-center gap-8 px-6">
          <View className="w-full flex-row justify-between">
            <RemoteButton label="Ligar ou desligar" icon="power" iconColor="#FFFFFF" className="bg-red-600 active:bg-red-700 dark:bg-red-600 dark:active:bg-red-700" onPress={() => send(RemoteKey.Power)} />
            <RemoteButton label="Teclado numérico" icon="dialpad" onPress={() => setNumberPadOpen(true)} />
          </View>

          <DPad onKey={send} />

          <View className="w-full flex-row justify-around">
            <RemoteButton label="Voltar" icon="back" className="h-16 w-16" onPress={() => send(RemoteKey.Back)} />
            <RemoteButton label="Início" icon="home" className="h-16 w-16" onPress={() => send(RemoteKey.Home)} />
            <RemoteButton label="Mudo" icon="mute" className="h-16 w-16" onPress={() => send(RemoteKey.Mute)} />
          </View>

          <View className="w-full flex-row items-center justify-between">
            <View className="items-center gap-1 rounded-full bg-zinc-200 py-1 dark:bg-zinc-800">
              <RemoteButton label="Aumentar volume" icon="plus" repeat onPress={() => send(RemoteKey.VolumeUp)} />
              <Text className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">VOL</Text>
              <RemoteButton label="Diminuir volume" icon="minus" repeat onPress={() => send(RemoteKey.VolumeDown)} />
            </View>

            <View className="flex-row gap-3">
              <RemoteButton label="Retroceder" icon="rewind" onPress={() => send(RemoteKey.Rewind)} />
              <RemoteButton label="Reproduzir ou pausar" icon="playPause" onPress={() => send(RemoteKey.PlayPause)} />
              <RemoteButton label="Avançar" icon="forward" onPress={() => send(RemoteKey.FastForward)} />
            </View>

            <View className="items-center gap-1 rounded-full bg-zinc-200 py-1 dark:bg-zinc-800">
              <RemoteButton label="Próximo canal" icon="up" repeat onPress={() => send(RemoteKey.ChannelUp)} />
              <Text className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">CH</Text>
              <RemoteButton label="Canal anterior" icon="down" repeat onPress={() => send(RemoteKey.ChannelDown)} />
            </View>
          </View>
        </View>
      </ScrollView>

      <NumberPad visible={numberPadOpen} onClose={() => setNumberPadOpen(false)} onKey={send} />
    </SafeAreaView>
  );
}
