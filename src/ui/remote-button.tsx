import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { Icon, type IconName } from './icon';

const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 120;

interface RemoteButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  readonly text?: string;
  readonly repeat?: boolean;
  readonly className?: string;
  readonly iconColor?: string;
  readonly iconSize?: number;
  readonly children?: ReactNode;
}

export function RemoteButton({ label, onPress, icon, text, repeat, className, iconColor, iconSize, children }: RemoteButtonProps) {
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval> }>({});
  const pressRef = useRef(onPress);
  useEffect(() => {
    pressRef.current = onPress;
  }, [onPress]);

  const stopRepeat = () => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.interval);
    timers.current = {};
  };

  useEffect(() => stopRepeat, []);

  const handlePressIn = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pressRef.current();
    if (!repeat) return;
    timers.current.delay = setTimeout(() => {
      timers.current.interval = setInterval(() => pressRef.current(), REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={handlePressIn}
      onPressOut={stopRepeat}
      hitSlop={4}
      className={`min-h-14 min-w-14 items-center justify-center rounded-full bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:active:bg-zinc-700 ${className ?? ''}`}
    >
      {icon && <Icon name={icon} color={iconColor} size={iconSize} />}
      {text && <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{text}</Text>}
      {children}
    </Pressable>
  );
}
