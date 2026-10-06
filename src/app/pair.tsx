import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { remoteStore, useRemote } from '@/state/remote';

const CODE_LENGTH = 6;
const NON_HEX = /[^0-9A-F]/g;

export default function PairScreen() {
  const [code, setCode] = useState('');
  const device = useRemote((state) => state.pairingDevice);
  const busy = useRemote((state) => state.busy);
  const error = useRemote((state) => state.error);

  useEffect(() => () => remoteStore.getState().cancelPairing(), []);

  const submit = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    if (await remoteStore.getState().submitCode(value)) {
      router.dismissAll();
      router.replace('/remote');
      return;
    }
    setCode('');
  };

  const onChange = (text: string) => {
    const next = text.toUpperCase().replace(NON_HEX, '').slice(0, CODE_LENGTH);
    setCode(next);
    if (next.length === CODE_LENGTH) void submit(next);
  };

  const restart = async () => {
    const target = remoteStore.getState().pairingDevice;
    if (target) await remoteStore.getState().startPairing(target);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <View className="flex-1 gap-6 p-6">
        <View className="flex-row justify-end">
          <Pressable accessibilityRole="button" hitSlop={12} onPress={() => router.back()}>
            <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">Cancelar</Text>
          </Pressable>
        </View>

        <View className="gap-2">
          <Text className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Parear com a TV</Text>
          <Text className="text-base text-zinc-500 dark:text-zinc-400">
            Digite o código de 6 caracteres que apareceu na tela {device ? `de ${device.name}` : 'da TV'}.
          </Text>
        </View>

        <TextInput
          accessibilityLabel="Código de pareamento"
          value={code}
          onChangeText={onChange}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          editable={!busy && device !== null}
          placeholder="A1B2C3"
          placeholderTextColor="#A1A1AA"
          className="min-h-20 rounded-2xl bg-zinc-100 text-center font-mono text-4xl tracking-[12px] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
        />

        {busy && <ActivityIndicator />}
        {error && <Text className="text-base text-red-600 dark:text-red-400">{error.message}</Text>}

        {!device && !busy && (
          <Text className="text-base text-zinc-500 dark:text-zinc-400">O pareamento foi encerrado. Volte e escolha a TV novamente.</Text>
        )}

        {device && !busy && (
          <Pressable accessibilityRole="button" onPress={restart} className="self-center p-3">
            <Text className="text-base font-semibold text-blue-600 dark:text-blue-400">Não apareceu código? Pedir novo código</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
