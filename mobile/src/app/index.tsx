import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, Camera, RasterSource, Layer, GeoJSONSource, type MapRef, type LineLayerStyle } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';

import { ActionBar } from '@/components/action-bar';
import { StatusBar as MapStatusBar } from '@/components/status-bar';
import { SettingsPanel } from '@/components/settings-panel';
import { FeatureListModal } from '@/components/feature-list-modal';
import { SearchModal } from '@/components/search-modal';
import { FeaturePopup } from '@/components/feature-popup';
import { HighscoreModal, type HighscoreFeature } from '@/components/highscore-modal';
import { RoutePlannerModal } from '@/components/route-planner-modal';
import { ToastOverlay, showToast } from '@/components/toast-overlay';
import {
  WMS_TILE_URL,
  BASE_MAP_STYLE,
  NORWAY_CENTER,
  NORWAY_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  type LayerInfo,
  type FeatureInfo,
} from '@/constants/map-config';
import {
  fetchCapabilitiesXML,
  parseCapabilities,
  buildFeatureInfoUrl,
  fetchFeatureInfo,
  parseFeatureInfoText,
  scanForHighscoreData,
  searchPlaces,
  scanViewportFeatures,
  type PlaceResult,
  type RouteResult,
} from '@/utils/map-api';

// Minimal empty style for "no basemap" (avoids empty/null mapStyle)
const EMPTY_STYLE = {
  version: 8 as const,
  sources: {} as Record<string, never>,
  layers: [] as never[],
};

export default function HomeScreen() {
  const isWeb = Platform.OS === 'web';
  const insets = useSafeAreaInsets();

  // ── Map refs & state ─────────────────────────────────────────────────────
  const mapRef = useRef<MapRef>(null);
  const [zoom, setZoom] = useState(NORWAY_ZOOM);
  const [center, setCenter] = useState<[number, number]>(NORWAY_CENTER);
  // Track actual map position for viewport scanning (updated on pan/zoom)
  const mapCenterRef = useRef<[number, number]>(NORWAY_CENTER);
  const mapZoomRef = useRef(NORWAY_ZOOM);

  // ── Layer state ──────────────────────────────────────────────────────────
  const [layerTree, setLayerTree] = useState<LayerInfo[]>([]);
  const [layersLoading, setLayersLoading] = useState(true);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [compositeVisible, setCompositeVisible] = useState(true);
  const compositeVisibleRef = useRef(true);

  // ── Basemap ──────────────────────────────────────────────────────────────
  const [basemap, setBasemap] = useState<'osm' | 'topo' | 'none'>('osm');
  const currentMapStyle =
    basemap === 'none'
      ? EMPTY_STYLE
      : basemap === 'topo'
        ? 'https://tiles.openfreemap.org/styles/topo'
        : BASE_MAP_STYLE;

  // ── Modal state ──────────────────────────────────────────────────────────
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupLoading, setPopupLoading] = useState(false);
  const [popupTitle, setPopupTitle] = useState('Stedsinfo');
  const [popupFeatures, setPopupFeatures] = useState<FeatureInfo[]>([]);
  const [highscoreVisible, setHighscoreVisible] = useState(false);
  const [highscoreLoading, setHighscoreLoading] = useState(false);
  const [highscoreFeatures, setHighscoreFeatures] = useState<HighscoreFeature[]>([]);
  const [featureListVisible, setFeatureListVisible] = useState(false);
  const [featureListLoading, setFeatureListLoading] = useState(false);
  const [featureListFeatures, setFeatureListFeatures] = useState<FeatureInfo[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [routePlannerVisible, setRoutePlannerVisible] = useState(false);
  const [routeGeojson, setRouteGeojson] = useState<RouteResult['geojson'] | null>(null);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);

  // ── GPS loading ──────────────────────────────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false);

  // ── Boot: load capabilities ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const xml = await fetchCapabilitiesXML();
        const groups = parseCapabilities(xml);
        if (groups.length === 0) {
          showToast('Ingen kartlag funnet.', 'error');
          return;
        }
        groups.sort((a: LayerInfo, b: LayerInfo) => a.title.localeCompare(b.title, 'no'));
        setLayerTree(groups);
      } catch (err: any) {
        const msg =
          err.name === 'AbortError'
            ? 'Tidsavbrudd ved lasting av kartlag.'
            : `Kunne ikke laste kartlag: ${err.message}`;
        showToast(msg, 'error');
      } finally {
        setLayersLoading(false);
      }
    })();
  }, []);

  // ── Layer toggling ──────────────────────────────────────────────────────
  const handleLayerToggle = useCallback((name: string) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // ── Composite toggle ───────────────────────────────────────────────────
  const handleCompositeToggle = useCallback(
    (visible: boolean) => {
      compositeVisibleRef.current = visible;
      setCompositeVisible(visible);
      mapRef.current
        ?.setSourceVisibility(visible, 'geonorge-wms')
        .catch(() => {});
    },
    [],
  );

  // ── Zoom helpers ────────────────────────────────────────────────────────
  const animateTo = useCallback(
    (target: [number, number], targetZoom: number) => {
      setCenter(target);
      setZoom(targetZoom);
    },
    [],
  );

  // ── GetFeatureInfo (core query) ──────────────────────────────────────────
  const queryFeatureInfoAt = useCallback(
    async (lngLat: [number, number]) => {
      setPopupLoading(true);
      setPopupVisible(true);
      setPopupTitle('Henter stedsinfo…');
      setPopupFeatures([]);

      try {
        const url = buildFeatureInfoUrl(
          [lngLat[0], lngLat[1]],
          [...activeLayers],
          zoom,
        );
        const text = await fetchFeatureInfo(url);
        const features = parseFeatureInfoText(text);

        const hasData = features.some((f) => f.props.size > 0);
        if (!hasData) {
          setPopupVisible(false);
          return;
        }

        // Title: coordinates
        const lat = lngLat[1].toFixed(5);
        const lon = lngLat[0].toFixed(5);
        setPopupTitle(`${lat}° N, ${lon}° Ø`);

        // Deduplicate by layerName + featureId
        const seen = new Set<string>();
        const unique = features.filter((f) => {
          const key = `${f.layerName}::${f.featureId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setPopupFeatures(unique);
      } catch (err: any) {
        showToast(`Feil ved henting av stedsinfo: ${err.message}`, 'error');
        setPopupFeatures([]);
        setPopupTitle('Stedsinfo');
      } finally {
        setPopupLoading(false);
      }
    },
    [activeLayers, zoom],
  );

  // ── GetFeatureInfo (map press handler) ──────────────────────────────────
  const handleMapPress = useCallback(
    async (event: any) => {
      const nativeEvent = event.nativeEvent ?? event;
      const lngLat = nativeEvent.lngLat as [number, number] | undefined;
      if (!lngLat || lngLat.length < 2) return;
      await queryFeatureInfoAt(lngLat);
    },
    [queryFeatureInfoAt],
  );

  // ── GPS ─────────────────────────────────────────────────────────────────
  const handleGPS = useCallback(async () => {
    if (isWeb) {
      showToast('GPS fungerer kun på mobil.', 'info');
      return;
    }

    setGpsLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast(
          'Posisjonstilgang nektet – sjekk systeminnstillinger.',
          'error',
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      animateTo([pos.coords.longitude, pos.coords.latitude], 14);
      setMyLocation([pos.coords.longitude, pos.coords.latitude]);
    } catch (err: any) {
      const msg =
        err.code === 2
          ? 'Posisjon utilgjengelig. Sjekk at posisjonstjenester er aktivert.'
          : err.code === 3
            ? 'Tidsavbrudd ved henting av posisjon.'
            : `Kunne ikke hente posisjon: ${err.message}`;
      showToast(msg, 'error');
    } finally {
      setGpsLoading(false);
    }
  }, [isWeb, animateTo]);

  // ── Route planner ──────────────────────────────────────────────────────
  const handleOpenRoutePlanner = useCallback(() => {
    setRoutePlannerVisible(true);
  }, []);

  const handleRouteResult = useCallback((result: RouteResult | null) => {
    setRouteGeojson(result?.geojson ?? null);
  }, []);

  const handleClearRoute = useCallback(() => {
    setRouteGeojson(null);
  }, []);

  // ── Viewport scanning ──────────────────────────────────────────────────
  const computeExtent = useCallback(() => {
    const curZoom = mapZoomRef.current;
    const curCenter = mapCenterRef.current;
    const lngPerPixel = 360 / (256 * Math.pow(2, curZoom));
    const latPerPixel = 180 / (256 * Math.pow(2, curZoom));
    const screenW = 360;
    const screenH = 600;
    const halfW = (screenW / 2) * lngPerPixel;
    const halfH = (screenH / 2) * latPerPixel;
    return {
      xMin: curCenter[0] - halfW,
      yMin: curCenter[1] - halfH,
      xMax: curCenter[0] + halfW,
      yMax: curCenter[1] + halfH,
    };
  }, []);

  const handleRegionChange = useCallback(
    (event: { nativeEvent: { center: [number, number]; zoom: number } }) => {
      mapCenterRef.current = event.nativeEvent.center;
      mapZoomRef.current = event.nativeEvent.zoom;
    },
    [],
  );

  const handleHighscore = useCallback(async () => {
    setHighscoreVisible(true);
    setHighscoreLoading(true);
    setHighscoreFeatures([]);

    try {
      const extent = computeExtent();
      const features = await scanForHighscoreData(extent);
      setHighscoreFeatures(features as unknown as HighscoreFeature[]);
    } catch (err: any) {
      showToast(`Feil ved skanning: ${err.message}`, 'error');
    } finally {
      setHighscoreLoading(false);
    }
  }, [computeExtent]);

  const handleOpenFeatureList = useCallback(async () => {
    setFeatureListVisible(true);
    setFeatureListLoading(true);
    setFeatureListFeatures([]);

    try {
      const extent = computeExtent();
      const features = await scanViewportFeatures(extent, [...activeLayers]);
      setFeatureListFeatures(features);
    } catch (err: any) {
      showToast(`Feil ved skanning: ${err.message}`, 'error');
    } finally {
      setFeatureListLoading(false);
    }
  }, [computeExtent, activeLayers]);

  const handleZoomToRoad = useCallback(
    (x: number, y: number) => {
      setHighscoreVisible(false);
      // Convert EPSG:3857 to lon/lat
      const lon = (x / 20037508.34) * 180;
      const lat =
        (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360) / Math.PI - 90;
      animateTo([lon, lat], 16);
    },
    [animateTo],
  );

  // ── Place search handler ────────────────────────────────────────────────
  const handleSearchPlace = useCallback(
    async (query: string): Promise<PlaceResult[]> => {
      return searchPlaces(query);
    },
    [],
  );

  const handleSelectPlace = useCallback(
    (place: PlaceResult) => {
      animateTo([place.lon, place.lat], 12);
    },
    [animateTo],
  );

  // ── Web fallback ────────────────────────────────────────────────────────
  if (isWeb) {
    return <View style={styles.webFallback}><ToastOverlay /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Map fills the screen (edge-to-edge, draws behind system bars) */}
      <View style={styles.mapWrapper}>
        <Map
          ref={mapRef}
          style={styles.map}
          mapStyle={currentMapStyle}
          onPress={handleMapPress}
          onRegionDidChange={handleRegionChange}
          attribution={false}
          logo={false}
        >
          <Camera
            center={center}
            zoom={zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
          />

          {/* WMS raster overlay */}
          <RasterSource
            id="geonorge-wms"
            tiles={[WMS_TILE_URL]}
            tileSize={256}
          >
            <Layer id="geonorge-wms-layer" type="raster" />
          </RasterSource>

          {/* Route overlay (local Dijkstra + accessibility overlay) */}
          {routeGeojson && (
            <GeoJSONSource
              id="route-source"
              data={routeGeojson}
            >
              <Layer
                id="route-line-outline"
                type="line"
                style={{
                  lineColor: '#000000',
                  lineWidth: 6,
                  lineOpacity: 0.4,
                } satisfies LineLayerStyle}
              />
              <Layer
                id="route-line"
                type="line"
                style={{
                  lineColor: '#ecaa30',
                  lineWidth: 3,
                  lineOpacity: 0.85,
                } satisfies LineLayerStyle}
              />
            </GeoJSONSource>
          )}
        </Map>
      </View>

      {/* HUD overlays (visible when modals are closed) */}
      {!settingsVisible && !popupVisible && !highscoreVisible && !featureListVisible && !searchVisible && (
        <>
          <ActionBar
            onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}
            onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}
            onResetView={() => animateTo(NORWAY_CENTER, NORWAY_ZOOM)}
            onGPS={handleGPS}
            onHighscore={handleHighscore}
            onOpenSettings={() => setSettingsVisible(true)}
            onOpenFeatureList={handleOpenFeatureList}
            onOpenSearch={() => setSearchVisible(true)}
            onOpenRoutePlanner={handleOpenRoutePlanner}
            gpsLoading={gpsLoading}
            safeAreaBottom={insets.bottom}
          />
          <MapStatusBar zoom={zoom} layerCount={activeLayers.size} safeAreaBottom={insets.bottom} />
        </>
      )}

      {/* Modals */}
      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        layerTree={layerTree}
        layersLoading={layersLoading}
        activeLayers={activeLayers}
        onLayerToggle={handleLayerToggle}
        compositeVisible={compositeVisible}
        onCompositeToggle={handleCompositeToggle}
        basemap={basemap}
        onBasemapChange={setBasemap}
      />

      <FeaturePopup
        visible={popupVisible}
        onClose={() => setPopupVisible(false)}
        loading={popupLoading}
        title={popupTitle}
        features={popupFeatures}
      />

      <FeatureListModal
        visible={featureListVisible}
        onClose={() => setFeatureListVisible(false)}
        loading={featureListLoading}
        features={featureListFeatures}
      />

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSearchPlace={handleSearchPlace}
        onSelectPlace={handleSelectPlace}
      />

      <RoutePlannerModal
        visible={routePlannerVisible}
        onClose={() => {
          setRoutePlannerVisible(false);
          handleClearRoute();
        }}
        myLocation={myLocation}
        onRouteResult={handleRouteResult}
      />

      <HighscoreModal
        visible={highscoreVisible}
        onClose={() => setHighscoreVisible(false)}
        loading={highscoreLoading}
        features={highscoreFeatures}
        onZoomTo={handleZoomToRoad}
      />

      <ToastOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  mapWrapper: {
    ...StyleSheet.absoluteFill,
  },
  map: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});