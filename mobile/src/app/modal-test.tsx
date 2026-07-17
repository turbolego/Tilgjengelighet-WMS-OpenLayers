/**
 * Test page for Playwright E2E tests.
 *
 * Renders all three modals (HighscoreModal, SettingsPanel, FeaturePopup)
 * with mocked data, triggered by dedicated buttons.
 *
 * This page avoids any native-only imports (@maplibre/maplibre-react-native,
 * expo-location, etc.) so it can render in Expo Web / react-native-web.
 */
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { type LayerInfo, type FeatureInfo } from '@/constants/map-config';
import type { HighscoreFeature } from '@/components/highscore-modal';
import { HighscoreModal } from '@/components/highscore-modal';
import { SettingsPanel } from '@/components/settings-panel';
import { FeaturePopup } from '@/components/feature-popup';

// ── Mock data ────────────────────────────────────────────────────────────────

const mockLayerTree: LayerInfo[] = [
  {
    name: 'tilgjengelighet3',
    title: 'Tilgjengelighet',
    children: [
      {
        name: 'tilgjengelighet3_vei',
        title: 'Vei og gate',
        children: [],
      },
      {
        name: 'tilgjengelighet3_sti',
        title: 'Sti og turvei',
        children: [],
      },
      {
        name: 'tilgjengelighet3_sn',
        title: 'Snarvei',
        children: [],
      },
      {
        name: 'tilgjengelighet3_trapp',
        title: 'Trapp',
        children: [],
      },
    ],
  },
  {
    name: 'tilgjengelighet3_ekstra',
    title: 'Tilleggsdata',
    children: [
      {
        name: 'tilgjengelighet3_parkering',
        title: 'Parkering',
        children: [],
      },
    ],
  },
];

const mockHighscoreFeatures: HighscoreFeature[] = [
  {
    centerX: 10.752,
    centerY: 59.912,
    props: new Map<string, string>([
      ['veitype', 'Turvei'],
      ['segmentlengde', '312.5'],
      ['stigning', '2.1'],
      ['bredde', '200'],
      ['kommune', 'Oslo'],
      ['dekke', 'Grus'],
      ['tilgjengvurderingrulleman', 'Tilgjengelig'],
      ['tilgjengvurderingrulleauto', 'Tilgjengelig'],
      ['tilgjengvurderingelrullestol', 'Tilgjengelig'],
      ['tilgjengvurderingsyn', 'Tilgjengelig'],
    ]),
  },
  {
    centerX: 10.735,
    centerY: 59.905,
    props: new Map<string, string>([
      ['veitype', 'Gang- og sykkelvei'],
      ['segmentlengde', '520.0'],
      ['stigning', '1.5'],
      ['bredde', '300'],
      ['kommune', 'Oslo'],
      ['dekke', 'Asfalt'],
      ['tilgjengvurderingrulleman', 'Tilgjengelig'],
      ['tilgjengvurderingrulleauto', 'Tilgjengelig'],
      ['tilgjengvurderingelrullestol', 'Tilgjengelig'],
      ['tilgjengvurderingsyn', 'Tilgjengelig'],
    ]),
  },
  {
    centerX: 10.745,
    centerY: 59.908,
    props: new Map<string, string>([
      ['veitype', 'Turvei'],
      ['segmentlengde', '180.2'],
      ['stigning', '5.8'],
      ['bredde', '150'],
      ['kommune', 'Oslo'],
      ['dekke', 'Grus'],
      ['tilgjengvurderingrulleman', 'Tilgjengelig'],
      ['tilgjengvurderingrulleauto', 'Tilgjengelig'],
      ['tilgjengvurderingelrullestol', 'Tilgjengelig'],
      ['tilgjengvurderingsyn', 'Tilgjengelig'],
    ]),
  },
];

const mockFeatureInfo: FeatureInfo[] = [
  {
    layerName: 'Vei og gate',
    featureId: '12345',
    props: new Map<string, string>([
      ['objekttypenavn', 'Turvei - grusdekke'],
      ['bredde', '200 cm'],
      ['stigning', '2.5 %'],
      ['veitype', 'Turvei'],
      ['kommune', 'Oslo'],
      ['fylkenavn', 'Oslo'],
      ['dekke', 'Grus'],
      ['fremkommelighet', 'Manuell rullestol, Elektrisk rullestol'],
      ['segmentlengde', '312.5 m'],
    ]),
    images: [],
  },
  {
    layerName: 'Vei og gate',
    featureId: '67890',
    props: new Map<string, string>([
      ['objekttypenavn', 'Gang- og sykkelvei'],
      ['bredde', '300 cm'],
      ['stigning', '1.2 %'],
      ['veitype', 'Gang- og sykkelvei'],
      ['kommune', 'Bergen'],
      ['fylkenavn', 'Vestland'],
      ['dekke', 'Asfalt'],
      ['fremkommelighet', 'Manuell rullestol, Elektrisk rullestol'],
      ['segmentlengde', '520.0 m'],
    ]),
    images: [],
  },
];

// ── Action button component ──────────────────────────────────────────────────

function ActionButton({
  label,
  onPress,
  color = MapColors.accent,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        actionStyles.button,
        { borderColor: color },
        pressed && actionStyles.buttonPressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={[actionStyles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const actionStyles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(28,37,51,0.95)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    backgroundColor: MapTheme.inkLight,
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

// ── Test page ────────────────────────────────────────────────────────────────

export default function ModalTestPage() {
  const [highscoreVisible, setHighscoreVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Page title */}
      <View style={styles.header}>
        <Text style={styles.title} testID="test-page-title" role="heading" aria-level={1}>
          Modal Test Page
        </Text>
        <Text style={styles.subtitle}>
          Playwright E2E test miljø for modal-komponenter
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Open buttons */}
        <ActionButton
          label="🏆 Åpne Toppliste"
          onPress={() => setHighscoreVisible(true)}
        />
        <ActionButton
          label="⚙️ Åpne Innstillinger"
          color={MapColors.bodyText}
          onPress={() => setSettingsVisible(true)}
        />
        <ActionButton
          label="📍 Åpne Stedsinfo"
          color={MapTheme.mist}
          onPress={() => setPopupVisible(true)}
        />

        {/* Color swatch info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Denne testesiden bruker mørkt tema med mock-data for å teste at
            modaler rendres korrekt, har innhold, og at lukkeknappene
            fungerer.
          </Text>
        </View>
      </ScrollView>

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <HighscoreModal
        visible={highscoreVisible}
        onClose={() => setHighscoreVisible(false)}
        loading={false}
        features={mockHighscoreFeatures}
        onZoomTo={(x, y) => {
          console.log(`Zoom to: ${x}, ${y} (web test mock)`);
        }}
      />

      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        layerTree={mockLayerTree}
        layersLoading={false}
        activeLayers={new Set(['tilgjengelighet3_vei', 'tilgjengelighet3_sti'])}
        onLayerToggle={(name) =>
          console.log(`Layer toggle: ${name} (web test mock)`)
        }
        compositeVisible={true}
        onCompositeToggle={(v) =>
          console.log(`Composite toggle: ${v} (web test mock)`)
        }
        basemap="osm"
        onBasemapChange={(v) =>
          console.log(`Basemap change: ${v} (web test mock)`)
        }
        onSearchPlace={async (query) => [
          {
            name: 'Oslo sentrum',
            municipality: 'Oslo',
            lat: 59.911,
            lon: 10.753,
          },
          {
            name: 'Bergen sentrum',
            municipality: 'Bergen',
            lat: 60.391,
            lon: 5.323,
          },
        ]}
        onSelectPlace={(place) =>
          console.log(`Select place: ${place.name} (web test mock)`)
        }
      />

      <FeaturePopup
        visible={popupVisible}
        onClose={() => setPopupVisible(false)}
        loading={false}
        title="Test — Stedsinfo"
        features={mockFeatureInfo}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MapTheme.ink,
  },
  header: {
    paddingTop: Platform.OS === 'web' ? 48 : 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.5)',
    backgroundColor: MapTheme.inkMid,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: MapColors.accent,
  },
  subtitle: {
    fontSize: 13,
    color: MapColors.mutedText,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 24,
  },
  infoBox: {
    backgroundColor: 'rgba(58,80,104,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(58,80,104,0.4)',
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    color: MapColors.mutedText,
    lineHeight: 20,
  },
});
