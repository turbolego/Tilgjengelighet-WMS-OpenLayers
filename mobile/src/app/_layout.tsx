import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout: Stack with tab group + standalone routes (modal-test for Playwright).
 * Root View with role="main" provides a landmark for axe-core WCAG AAA.
 */
export default function RootLayout() {
  return (
    <View style={{ flex: 1 }} role="main">
      <Head>
        <title>Geonorge Tilgjengelighet</title>
      </Head>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="(tabs)"
          options={{ title: 'Kart' }}
        />
        <Stack.Screen
          name="modal-test"
          options={{ presentation: 'modal', animation: 'none', title: 'Modal Test' }}
        />
      </Stack>
    </View>
  );
}
