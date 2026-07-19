import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout: provide safe area context, then stack with tab group.
 * Root View with role="main" provides a landmark for axe-core WCAG AAA.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} role="main">
        <Head>
          <title>Geonorge Tilgjengelighet</title>
        </Head>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="index"
            options={{ title: 'Kart' }}
          />
          <Stack.Screen
            name="modal-test"
            options={{ presentation: 'modal', animation: 'none', title: 'Modal Test' }}
          />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}
