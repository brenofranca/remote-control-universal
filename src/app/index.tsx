import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useZeroconf, type ZeroconfError } from 'react-native-zeroconf';
import type { TvDevice } from '@/domain/tv-device';
import { ANDROID_TV_SERVICE, manualTvDevice, toTvDevice } from '@/discovery/to-tv-device';
import { remoteStore, useRemote } from '@/state/remote';
import { Icon } from '@/ui/icon';

const LOCAL_NETWORK_DENIED = -65570;

const discoveryErrorMessage = (error: ZeroconfError): string =>
  error.code === LOCAL_NETWORK_DENIED
    ? 'Permita o acesso à Rede Local em Ajustes > Privacidade e Segurança > Rede Local.'
    : 'Não foi possível procurar TVs na rede. Digite o IP da TV abaixo.';

export default function DiscoverScreen() {
  const [restoring, setRestoring] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const error = useRemote((state) => state.error);
  const savedTvs = useRemote((state) => state.savedTvs);
  const { services, isScanning, error: scanError, restart } = useZeroconf({ ...ANDROID_TV_SERVICE, enabled: !restoring });

  const discovered = useMemo(
    () => services.map(toTvDevice).filter((device): device is TvDevice => device !== null),
    [services],
  );
  // TV salva encontrada na rede usa o endereço novo (o roteador pode ter trocado o IP).
  const saved = useMemo(
    () => savedTvs.map((device) => ({ device: discovered.find((found) => found.id === device.id) ?? device, online: discovered.some((found) => found.id === device.id) })),
    [savedTvs, discovered],
  );
  const devices = useMemo(() => discovered.filter((device) => !savedTvs.some((known) => known.id === device.id)), [discovered, savedTvs]);

  useEffect(() => {
    remoteStore
      .getState()
      .restore()
      .then((saved) => (saved ? router.replace('/remote') : setRestoring(false)))
      .finally(() => SplashScreen.hide());
  }, []);

  const select = async (device: TvDevice) => {
    if (selectedId) return;
    setSelectedId(device.id);
    const outcome = await remoteStore.getState().select(device);
    setSelectedId(null);
    if (outcome === 'connected') router.replace('/remote');
    if (outcome === 'pairing') router.push('/pair');
  };

  const connectManual = () => {
    const device = manualTvDevice(manualAddress);
    if (!device) {
      setManualError('Digite um IP da rede local, por exemplo 192.168.0.20.');
      return;
    }
    setManualError(null);
    void select(device);
  };

  const confirmRemove = (device: TvDevice) =>
    Alert.alert('Remover TV', `Remover ${device.name} da lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => void remoteStore.getState().removeTv(device.id) },
    ]);

  if (restoring) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 p-6" keyboardShouldPersistTaps="handled">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Controle Remoto</Text>
            <Text className="text-base text-zinc-500 dark:text-zinc-400">
              Conecte o celular na mesma rede Wi‑Fi da TV e escolha a TV abaixo.
            </Text>
          </View>

          {saved.length > 0 && (
            <View className="gap-3">
              <Text className="text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">Minhas TVs</Text>
              {saved.map(({ device, online }) => (
                <View key={device.id} className="min-h-16 flex-row items-center gap-2 rounded-2xl bg-zinc-100 pl-4 dark:bg-zinc-900">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Conectar em ${device.name}`}
                    onPress={() => select(device)}
                    className="flex-1 flex-row items-center gap-4 py-3"
                  >
                    <Icon name="tv" />
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{device.name}</Text>
                      <View className="flex-row items-center gap-2">
                        <View className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-zinc-400'}`} />
                        <Text className="text-sm text-zinc-500 dark:text-zinc-400">{online ? `Na rede · ${device.address}` : device.address}</Text>
                      </View>
                    </View>
                    {selectedId === device.id && <ActivityIndicator />}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${device.name}`}
                    onPress={() => confirmRemove(device)}
                    className="h-16 w-14 items-center justify-center"
                  >
                    <Icon name="close" size={18} color="#A1A1AA" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                {saved.length > 0 ? 'Outras TVs na rede' : 'TVs encontradas'}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Procurar novamente" hitSlop={12} onPress={restart}>
                {isScanning ? <ActivityIndicator /> : <Icon name="refresh" size={20} />}
              </Pressable>
            </View>

            {devices.map((device) => (
              <Pressable
                key={device.id}
                accessibilityRole="button"
                accessibilityLabel={`Conectar em ${device.name}`}
                onPress={() => select(device)}
                className="min-h-16 flex-row items-center gap-4 rounded-2xl bg-zinc-100 px-4 py-3 active:bg-zinc-200 dark:bg-zinc-900 dark:active:bg-zinc-800"
              >
                <Icon name="tv" />
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{device.name}</Text>
                  <Text className="text-sm text-zinc-500 dark:text-zinc-400">{device.address}</Text>
                </View>
                {selectedId === device.id && <ActivityIndicator />}
              </Pressable>
            ))}

            {devices.length === 0 && (
              <Text className="rounded-2xl bg-zinc-100 p-4 text-base text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                {scanError
                  ? discoveryErrorMessage(scanError)
                  : isScanning
                    ? 'Procurando TVs com Google TV / Android TV…'
                    : 'Nenhuma outra TV encontrada.'}
              </Text>
            )}
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold uppercase text-zinc-500 dark:text-zinc-400">Ou digite o IP da TV</Text>
            <Text className="text-sm text-zinc-500 dark:text-zinc-400">
              Na TV: Configurações › Rede e Internet › sua rede Wi‑Fi › Endereço IP.
            </Text>
            <View className="flex-row gap-3">
              <TextInput
                accessibilityLabel="Endereço IP da TV"
                value={manualAddress}
                onChangeText={setManualAddress}
                onSubmitEditing={connectManual}
                placeholder="192.168.0.20"
                placeholderTextColor="#A1A1AA"
                keyboardType="decimal-pad"
                autoCorrect={false}
                autoCapitalize="none"
                maxLength={15}
                className="min-h-14 flex-1 rounded-2xl bg-zinc-100 px-4 text-lg text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Conectar pelo IP"
                onPress={connectManual}
                className="min-h-14 items-center justify-center rounded-2xl bg-blue-600 px-5 active:bg-blue-700"
              >
                {selectedId?.startsWith('ip:') ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Conectar</Text>}
              </Pressable>
            </View>
            {manualError && <Text className="text-sm text-red-600 dark:text-red-400">{manualError}</Text>}
          </View>

          {error && (
            <Pressable onPress={() => remoteStore.getState().clearError()} className="rounded-2xl bg-red-50 p-4 dark:bg-red-950">
              <Text className="text-base text-red-700 dark:text-red-300">{error.message}</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
