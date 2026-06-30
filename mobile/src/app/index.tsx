import Constants from 'expo-constants';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { UrlTile, WMSTile } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';

const WEB_APP_URL =
  (Constants.expoConfig?.extra?.webAppUrl as string | undefined) ??
  'https://turbolego.github.io/Tilgjengelighet-WMS-OpenLayers/';
const INITIAL_REGION = {
  latitude: 65.0,
  longitude: 15.5,
  latitudeDelta: 12,
  longitudeDelta: 12,
};
const WMS_TILE_URL =
  'https://wms.geonorge.no/skwms1/wms.tilgjengelighet3?service=WMS&request=GetMap&version=1.1.1&layers=tilgjengelighet3&styles=&format=image/png&transparent=true&srs=EPSG:3857&width=256&height=256&bbox={minX},{minY},{maxX},{maxY}';

export default function HomeScreen() {
  const isWeb = Platform.OS === 'web';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title" style={styles.title}>Geonorge Tilgjengelighet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Native app shell for Android and iOS using Expo.
          </ThemedText>
        </ThemedView>

        {isWeb ? (
          <View style={styles.webFallback}>
            <ThemedText type="body">Open the production map in a new tab:</ThemedText>
            <Pressable onPress={() => Linking.openURL(WEB_APP_URL)} style={styles.openButton}>
              <ThemedText type="link">Open map web app</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.mapContainer}>
            <MapView style={styles.map} initialRegion={INITIAL_REGION}>
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                zIndex={1}
              />
              <WMSTile urlTemplate={WMS_TILE_URL} zIndex={2} />
            </MapView>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: { gap: Spacing.one },
  title: {
    textAlign: 'left',
  },
  mapContainer: {
    flex: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  webFallback: {
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  openButton: {
    paddingVertical: Spacing.two,
  },
});
