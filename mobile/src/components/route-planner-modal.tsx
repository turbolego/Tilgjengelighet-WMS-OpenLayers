import React, { useState, useCallback } from 'react';
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
import { PlaceSearch } from '@/components/place-search';
import type { PlaceResult, RouteResult } from '@/utils/map-api';

export interface RoutePlannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSearchPlace: (query: string) => Promise<PlaceResult[]>;
  /** Current GPS position [lng, lat] or null if unavailable */
  myLocation: [number, number] | null;
  /** Called when user wants GPS (triggers location fetch in parent) */
  onRequestMyLocation: () => void;
  /** Fetch route between two points */
  onFetchRoute: (
    from: [number, number],
    to: [number, number],
  ) => Promise<RouteResult>;
  /** Called to show the route on the map */
  onShowRoute: (geojson: any, from: [number, number], to: [number, number]) => void;
  /** Clear route from map */
  onClearRoute: () => void;
}

type PlaceSelection = { kind: 'place'; place: PlaceResult } | { kind: 'mylocation' };

export function RoutePlannerModal({
  visible,
  onClose,
  onSearchPlace,
  myLocation,
  onRequestMyLocation,
  onFetchRoute,
  onShowRoute,
  onClearRoute,
}: RoutePlannerModalProps) {
  const [fromSelection, setFromSelection] = useState<PlaceSelection | null>(null);
  const [toSelection, setToSelection] = useState<PlaceSelection | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [sameLocationError, setSameLocationError] = useState(false);

  const myLocationUnavailable = !myLocation;

  // ── Resolve selection to [lng, lat] ──────────────────────────────────
  const resolveCoord = useCallback(
    (sel: PlaceSelection): [number, number] | null => {
      if (sel.kind === 'mylocation') return myLocation;
      return [sel.place.lon, sel.place.lat];
    },
    [myLocation],
  );

  // ── Label helpers ────────────────────────────────────────────────────
  const selectionLabel = (sel: PlaceSelection | null, defaultLabel: string): string | undefined => {
    if (!sel) return undefined;
    if (sel.kind === 'mylocation') return 'Min posisjon';
    return sel.place.name;
  };

  const selectionSubtitle = (sel: PlaceSelection | null): string | undefined => {
    if (!sel || sel.kind === 'mylocation') return undefined;
    return sel.place.municipality;
  };

  const isMyLocation = (sel: PlaceSelection | null): boolean =>
    sel?.kind === 'mylocation';

  // ── Plan route ───────────────────────────────────────────────────────
  const handlePlanRoute = useCallback(async () => {
    const fromCoord = fromSelection ? resolveCoord(fromSelection) : null;
    const toCoord = toSelection ? resolveCoord(toSelection) : null;
    if (!fromCoord || !toCoord) return;

    // Check for same location
    if (
      fromSelection?.kind === toSelection?.kind &&
      (fromSelection?.kind === 'mylocation' ||
        (fromSelection?.kind === 'place' &&
          toSelection?.kind === 'place' &&
          fromSelection.place.lat === toSelection.place.lat &&
          fromSelection.place.lon === toSelection.place.lon))
    ) {
      setSameLocationError(true);
      return;
    }
    setSameLocationError(false);

    setRouteLoading(true);
    setRouteError('');
    setRouteResult(null);

    try {
      const result = await onFetchRoute(fromCoord, toCoord);
      setRouteResult(result);
      onShowRoute(result.geojson, fromCoord, toCoord);
    } catch (err: any) {
      const msg =
        err.message?.includes('404') || err.message?.includes('400')
          ? 'Ingen rute funnet mellom disse punktene.'
          : err.message?.includes('403')
            ? 'API-nøkkel mangler eller er ugyldig.'
            : `Feil ved ruteplanlegging: ${err.message}`;
      setRouteError(msg);
    } finally {
      setRouteLoading(false);
    }
  }, [fromSelection, toSelection, resolveCoord, onFetchRoute, onShowRoute]);

  // ── Reset ────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setFromSelection(null);
    setToSelection(null);
    setRouteResult(null);
    setRouteError('');
    setSameLocationError(false);
    onClearRoute();
  }, [onClearRoute]);

  // ── Whether both fields are set ──────────────────────────────────────
  const canPlan = fromSelection !== null && toSelection !== null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      aria-label="Ruteplanlegger"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Lukk ruteplanlegger"
        accessibilityHint="Trykk for å lukke"
        accessibilityRole="button"
      >
        <View />
      </Pressable>
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🧭 Ruteplanlegger</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Lukk vindu"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {/* ── Fra ──────────────────────────────────────────────────── */}
          <Text style={styles.fieldLabel}>Fra</Text>
          <PlaceSearch
            placeholder="Søk fra…"
            onSearch={onSearchPlace}
            onSelect={(place) => setFromSelection({ kind: 'place', place })}
            selectedLabel={selectionLabel(fromSelection, 'Fra')}
            selectedSubtitle={selectionSubtitle(fromSelection)}
            onClearSelection={() => setFromSelection(null)}
            actionLabel="Min posisjon"
            onAction={() => {
              if (!myLocationUnavailable) {
                setFromSelection({ kind: 'mylocation' });
              } else {
                onRequestMyLocation();
              }
            }}
            actionActive={isMyLocation(fromSelection)}
            myLocationUnavailable={myLocationUnavailable}
          />

          {/* ── Divider ──────────────────────────────────────────────── */}
          <View style={styles.divider} />

          {/* ── Til ──────────────────────────────────────────────────── */}
          <Text style={styles.fieldLabel}>Til</Text>
          <PlaceSearch
            placeholder="Søk til…"
            onSearch={onSearchPlace}
            onSelect={(place) => setToSelection({ kind: 'place', place })}
            selectedLabel={selectionLabel(toSelection, 'Til')}
            selectedSubtitle={selectionSubtitle(toSelection)}
            onClearSelection={() => setToSelection(null)}
            actionLabel="Min posisjon"
            onAction={() => {
              if (!myLocationUnavailable) {
                setToSelection({ kind: 'mylocation' });
              } else {
                onRequestMyLocation();
              }
            }}
            actionActive={isMyLocation(toSelection)}
            myLocationUnavailable={myLocationUnavailable}
          />

          {/* ── Plan route button ────────────────────────────────────── */}
          <Pressable
            onPress={canPlan && !routeLoading ? handlePlanRoute : undefined}
            style={({ pressed }) => [
              styles.planButton,
              (!canPlan || routeLoading) && styles.planButtonDisabled,
              pressed && canPlan && !routeLoading && styles.planButtonPressed,
            ]}
            disabled={!canPlan || routeLoading}
            accessibilityRole="button"
            accessibilityLabel={
              routeLoading
                ? 'Henter rute…'
                : !canPlan
                  ? 'Velg fra og til'
                  : 'Planlegg rute'
            }
            accessibilityHint={
              canPlan ? 'Trykk for å planlegge en tilgjengelig rute' : undefined
            }
          >
            {routeLoading ? (
              <View style={styles.planButtonLoading}>
                <ActivityIndicator size="small" color={MapTheme.ink} />
                <Text style={styles.planButtonText}>Henter rute…</Text>
              </View>
            ) : (
              <Text style={styles.planButtonText}>🧭 Planlegg rute</Text>
            )}
          </Pressable>

          {/* ── Same-location warning ────────────────────────────────── */}
          {sameLocationError && (
            <Text style={styles.error}>
              Velg to forskjellige steder for å planlegge en rute.
            </Text>
          )}

          {/* ── Route error ──────────────────────────────────────────── */}
          {routeError !== '' && (
            <Text style={styles.error}>{routeError}</Text>
          )}

          {/* ── Route result ──────────────────────────────────────────── */}
          {routeResult && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>📊 Ruteinformasjon</Text>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Avstand</Text>
                <Text style={styles.resultValue}>
                  {routeResult.distanceLabel}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Varighet</Text>
                <Text style={styles.resultValue}>
                  {routeResult.durationLabel}
                </Text>
              </View>

              {/* ── Reset / close buttons ────────────────────────────── */}
              <View style={styles.resultActions}>
                <Pressable
                  onPress={handleReset}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Nullstill rute"
                >
                  <Text style={styles.actionButtonText}>🔄 Nullstill</Text>
                </Pressable>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.actionButton,
                    styles.actionButtonPrimary,
                    pressed && styles.actionButtonPrimaryPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Lukk ruteplanlegger"
                >
                  <Text style={styles.actionButtonPrimaryText}>🗺️ Vis på kart</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: MapColors.backdrop,
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '92%',
    maxWidth: 520,
    maxHeight: '85%',
    backgroundColor: MapColors.surface,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.5)',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: MapColors.whiteText,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  closeButtonText: {
    fontSize: 14,
    color: MapColors.mutedText,
  },
  body: {
    padding: 18,
    flex: 1,
  },

  // ── Field labels ─────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MapColors.mutedText,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 1,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(58,80,104,0.3)',
    marginVertical: 16,
  },

  // ── Plan route button ───────────────────────────────────────────────
  planButton: {
    backgroundColor: MapColors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  planButtonDisabled: {
    backgroundColor: MapTheme.inkLight,
    opacity: 0.5,
  },
  planButtonPressed: {
    backgroundColor: MapColors.accentHover,
  },
  planButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: MapTheme.ink,
  },

  // ── Error ────────────────────────────────────────────────────────────
  error: {
    color: MapTheme.redWarn,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },

  // ── Route result card ────────────────────────────────────────────────
  resultCard: {
    marginTop: 18,
    backgroundColor: MapTheme.ink,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 10,
    padding: 16,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: MapColors.headingText,
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.3)',
  },
  resultLabel: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  resultValue: {
    fontSize: 13,
    fontWeight: '600',
    color: MapColors.whiteText,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MapTheme.inkLight,
    borderWidth: 1,
    borderColor: MapColors.border,
  },
  actionButtonPressed: {
    backgroundColor: MapTheme.ink,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: MapColors.whiteText,
  },
  actionButtonPrimary: {
    backgroundColor: MapColors.accent,
    borderColor: MapColors.accent,
  },
  actionButtonPrimaryPressed: {
    backgroundColor: MapColors.accentHover,
  },
  actionButtonPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: MapTheme.ink,
  },
});