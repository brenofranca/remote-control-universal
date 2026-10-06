import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RemoteKey } from '@/domain/remote-key';
import { RemoteButton } from './remote-button';

const DIGITS: readonly (readonly [string, RemoteKey])[] = [
  ['1', RemoteKey.Digit1],
  ['2', RemoteKey.Digit2],
  ['3', RemoteKey.Digit3],
  ['4', RemoteKey.Digit4],
  ['5', RemoteKey.Digit5],
  ['6', RemoteKey.Digit6],
  ['7', RemoteKey.Digit7],
  ['8', RemoteKey.Digit8],
  ['9', RemoteKey.Digit9],
];

interface NumberPadProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onKey: (key: RemoteKey) => void;
}

export function NumberPad({ visible, onClose, onKey }: NumberPadProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar teclado numérico" className="flex-1 bg-black/40" onPress={onClose} />
      <View className="rounded-t-3xl bg-zinc-50 px-8 pt-4 dark:bg-zinc-900" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-zinc-300 dark:bg-zinc-700" />
        <Text className="mb-4 text-center text-base text-zinc-500 dark:text-zinc-400">Teclado numérico</Text>
        <View className="flex-row flex-wrap justify-between gap-y-4">
          {DIGITS.map(([digit, key]) => (
            <RemoteButton key={digit} label={digit} text={digit} className="h-16 w-[30%]" onPress={() => onKey(key)} />
          ))}
          <View className="w-[30%]" />
          <RemoteButton label="0" text="0" className="h-16 w-[30%]" onPress={() => onKey(RemoteKey.Digit0)} />
          <RemoteButton label="Fechar" icon="close" className="h-16 w-[30%]" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
