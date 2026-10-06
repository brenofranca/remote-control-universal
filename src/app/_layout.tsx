import '../../global.css';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

// A tela inicial esconde a splash depois de decidir entre a lista de TVs e o controle.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="pair" options={{ presentation: 'modal' }} />
        <Stack.Screen name="remote" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
