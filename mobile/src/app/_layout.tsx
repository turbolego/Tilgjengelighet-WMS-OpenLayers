import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout: Stack with tab group + standalone routes (modal-test for Playwright).
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="modal-test"
          options={{ presentation: 'modal', animation: 'none' }}
        />
      </Stack>
    </>
  );
}
