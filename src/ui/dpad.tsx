import { View } from 'react-native';
import { RemoteKey } from '@/domain/remote-key';
import { RemoteButton } from './remote-button';

const ARROW = 'absolute h-20 w-20 bg-transparent active:bg-zinc-300 dark:bg-transparent dark:active:bg-zinc-700';

export function DPad({ onKey }: { onKey: (key: RemoteKey) => void }) {
  return (
    <View className="h-64 w-64 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
      <RemoteButton label="Cima" icon="up" iconSize={32} repeat className={`${ARROW} top-1`} onPress={() => onKey(RemoteKey.DpadUp)} />
      <RemoteButton label="Baixo" icon="down" iconSize={32} repeat className={`${ARROW} bottom-1`} onPress={() => onKey(RemoteKey.DpadDown)} />
      <RemoteButton label="Esquerda" icon="left" iconSize={32} repeat className={`${ARROW} left-1`} onPress={() => onKey(RemoteKey.DpadLeft)} />
      <RemoteButton label="Direita" icon="right" iconSize={32} repeat className={`${ARROW} right-1`} onPress={() => onKey(RemoteKey.DpadRight)} />
      <RemoteButton
        label="OK"
        text="OK"
        className="h-24 w-24 bg-zinc-50 active:bg-zinc-100 dark:bg-zinc-950 dark:active:bg-zinc-900"
        onPress={() => onKey(RemoteKey.Ok)}
      />
    </View>
  );
}
