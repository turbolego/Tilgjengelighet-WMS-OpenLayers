import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { fetchRoute, searchPlaces, type PlaceResult, type RouteResult } from '@/utils/map-api';
import { PlaceSearch } from './place-search';

interface RoutePlannerModalProps {
  visible: boolean;
  onClose: () => void;
  myLocation: [number, number] | null;
  onRouteResult: (result: RouteResult) => void;
}

export function RoutePlannerModal({
  visible,
  onClose,
  myLocation,
  onRouteResult,
}: RoutePlannerModalProps) {
  const [from, setFrom] = useState<PlaceResult | null>(null);
  const [to, setTo] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState('');

  const useMyLocationFrom = !!myLocation && from?.name === 'Min posisjon';
  const useMyLocationTo = !!myLocation && to?.name === 'Min posisjon';

  const handlePlanRoute = useCallback(async () => {
    if (!from && !useMyLocationFrom) {
      setError('Velg startpunkt eller bruk Min posisjon.');
      return;
    }
    if (!to) {
      setError('Velg destinasjon.');
      return;
    }

    setLoading(true);
    setError('');
    setRouteResult(null);

    const fromLngLat: [number, number] = useMyLocationFrom
      ? myLocation!
      : [from!.lon, from!.lat];
    const toLngLat: [number, number] = [to.lon, to.lat];

    try {
      const result = await fetchRoute(fromLngLat, toLngLat);
      setRouteResult(result);
      onRouteResult(result);
    } catch (err: any) {
      setError(err.message ?? 'Kunne ikke beregne rute.');
    } finally {
      setLoading(false);
    }
  }, [from, to, useMyLocationFrom, myLocation, onRouteResult]);

  const handleClearRoute = useCallback(() => {
    setRouteResult(null);
    setError('');
  }, []);

  const handleClose = useCallback(() => {
    setRouteResult(null);
    setFrom(null);
    setTo(null);
    setError('');
    setLoading(false);
    onClose();
  }, [onClose]);

  const handleMyLocationToggle = (target: 'from' | 'to') => {
    if (!myLocation) return;
    const loc: PlaceResult = {
      name: 'Min posisjon',
      municipality: '',
      lat: myLocation[1],
      lon: myLocation[0],
    };
    if (target === 'from') {
      setFrom((prev) => (prev?.name === 'Min posisjon' ? null : loc));
    } else {
      setTo((prev) => (prev?.name === 'Min posisjon' ? null : loc));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      accessibilityViewIsModal
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🧭 Ruteplanlegger</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Lukk ruteplanlegger"
            accessibilityHint="Lukker ruteplanleggingsmodalen"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 🟢 From */}
          <Text style={styles.sectionLabel}>Fra</Text>
          <PlaceSearch
            placeholder="Søk etter startsted…"
            onSearch={searchPlaces}
            onSelect={setFrom}
            selectedLabel={from?.name}
            selectedSubtitle={from?.municipality}
            onClearSelection={from ? () => setFrom(null) : undefined}
            myLocationUnavailable={!myLocation}
            actionLabel="Min posisjon"
            onAction={() => handleMyLocationToggle('from')}
            actionActive={useMyLocationFrom}
            a11yLabel="Søk etter startsted"
            a11yHint="Søk etter stedsnavn for rutens startpunkt"
          />

          {/* 🏁 To */}
          <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Til</Text>
          <PlaceSearch
            placeholder="Søk etter destinasjon…"
            onSearch={searchPlaces}
            onSelect={setTo}
            selectedLabel={to?.name}
            selectedSubtitle={to?.municipality}
            onClearSelection={to ? () => setTo(null) : undefined}
            myLocationUnavailable={!myLocation}
            actionLabel="Min posisjon"
            onAction={() => handleMyLocationToggle('to')}
            actionActive={useMyLocationTo}
            a11yLabel="Søk etter destinasjon"
            a11yHint="Søk etter stedsnavn for rutens destinasjon"
          />

          {/* Plan button */}
          <Pressable
            onPress={handlePlanRoute}
            style={({ pressed }) => [
              styles.planButton,
              pressed && styles.planButtonPressed,
            ]}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Planlegg rute"
          >
            {loading ? (
              <ActivityIndicator color={MapTheme.ink} size="small" />
            ) : (
              <Text style={styles.planButtonText}>🧭 Planlegg rute</Text>
            )}
          </Pressable>

          {/* Error */}
          {error !== '' && <Text style={styles.error}>{error}</Text>}

          {/* Route result */}
          {routeResult && (
            <View style={styles.result}>
              <Text style={styles.resultTitle}>Rute</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Avstand:</Text>
                <Text style={styles.resultValue}>{routeResult.distanceLabel}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Estimert tid:</Text>
                <Text style={styles.resultValue}>{routeResult.durationLabel}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Tilgjengelighet:</Text>
                <Text style={styles.resultValue}>
                  {routeResult.accessiblePct}% av ruten har full tilgjengelighetsvurdering
                </Text>
              </View>

              {/* Accessibility breakdown */}
              {routeResult.segments.length > 0 && (
                <View style={styles.breakdown}>
                  <Text style={styles.breakdownTitle}>Detaljer</Text>
                  {(() => {
                    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
                    for (const s of routeResult.segments) {
                      counts[s.score]++;
                    }
                    return (
                      <>
                        {counts[3] > 0 && (
                          <Text style={styles.breakdownRow}>
                            🟢 {counts[3]} segment(er) – Tilgjengelig
                          </Text>
                        )}
                        {counts[2] > 0 && (
                          <Text style={styles.breakdownRow}>
                            🟡 {counts[2]} segment(er) – Delvis tilgjengelig
                          </Text>
                        )}
                        {counts[1] > 0 && (
                          <Text style={styles.breakdownRow}>
                            🔴 {counts[1]} segment(er) – Ikke tilgjengelig
                          </Text>
                        )}
                        {counts[0] > 0 && (
                          <Text style={styles.breakdownRow}>
                            ⚪ {counts[0]} segment(er) – Ingen vurdering
                          </Text>
                        )}
                      </>
                    );
                  })()}
                </View>
              )}

              <Pressable
                onPress={handleClearRoute}
                style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel="Fjern rutelinje"
              >
                <Text style={styles.clearBtnText}>Fjern rute fra kart</Text>
              </Pressable>
            </View>
          )}

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.infoText}>
              Ruteberegning bruker gangnettverket (OSRM, åpen rutetjeneste).
              Tilgjengelighetsvurdering fra kommunens kartdata (t_vei_r).
            </Text>
            <Text style={styles.infoSub}>
              Produserer du mange ruter? Vurder å hoste OSRM selv:{'\n'}
              github.com/Project-OSRM/osrm-backend
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MapTheme.ink,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: MapColors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: MapColors.whiteText,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: MapTheme.inkLight,
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  closeBtnText: {
    fontSize: 16,
    color: MapColors.mutedText,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 0,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: MapColors.mutedText,
    marginBottom: 8,
  },
  planButton: {
    backgroundColor: MapTheme.amber,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  planButtonPressed: {
    opacity: 0.85,
  },
  planButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: MapTheme.ink,
  },
  error: {
    color: MapTheme.redWarn,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  result: {
    backgroundColor: MapTheme.inkLight,
    borderRadius: 8,
    padding: 14,
    marginTop: 12,
    gap: 6,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: MapColors.whiteText,
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultLabel: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '600',
    color: MapColors.whiteText,
    textAlign: 'right',
  },
  breakdown: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(58,80,104,0.4)',
    gap: 4,
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: MapColors.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  breakdownRow: {
    fontSize: 12,
    color: MapColors.whiteText,
  },
  clearBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 6,
  },
  clearBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  clearBtnText: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  info: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(58,80,104,0.3)',
    borderRadius: 8,
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    color: MapColors.mutedText,
    lineHeight: 16,
  },
  infoSub: {
    fontSize: 11,
    color: 'rgba(232,160,32,0.6)',
    lineHeight: 16,
  },
});