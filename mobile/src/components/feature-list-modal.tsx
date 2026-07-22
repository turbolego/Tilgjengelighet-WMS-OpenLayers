import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { esc } from '@/utils/map-api';
import type { FeatureInfo } from '@/constants/map-config';
import { FeatureDetail } from '@/components/feature-popup';

export interface FeatureListModalProps {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  features: FeatureInfo[];
}

/** Extract a human-readable type label for grouping. */
function groupLabel(feat: FeatureInfo): string {
  const keys = ['objekttypenavn', 'objtype', 'type', 'kategori'];
  for (const k of keys) {
    const v = feat.props.get(k);
    if (v && v.trim() !== '') return v.trim();
  }
  return feat.layerName || 'Annet';
}

export function FeatureListModal({
  visible,
  onClose,
  loading,
  features,
}: FeatureListModalProps) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(new Set<string>());
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<FeatureInfo | null>(null);

  // Group features by object type
  const grouped = useMemo(() => {
    const map = new Map<string, FeatureInfo[]>();
    for (const f of features) {
      if (f.props.size === 0) continue;
      const key = groupLabel(f);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'no'));
  }, [features]);

  // Unique group names for filter chips
  const groupNames = useMemo(() => grouped.map(([name]) => name), [grouped]);

  // Active groups after applying filter
  const visibleGroups = filter
    ? grouped.filter(([name]) => name === filter)
    : grouped;

  const toggleGroup = useCallback((name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const totalCount = features.filter((f) => f.props.size > 0).length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      aria-label="Objekter i kartet"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Lukk objektliste"
        accessibilityHint="Trykk for å lukke"
        accessibilityRole="button"
      >
        <View />
      </Pressable>
      <View style={[styles.panel, { top: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            📋{' '}
            {loading
              ? 'Skanner kartet…'
              : `${totalCount} objekt${totalCount !== 1 ? 'er' : ''} i kartet`}
          </Text>
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

        {/* Loading spinner */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={MapTheme.amber} />
            <Text style={styles.loadingText}>Henter objekter i synlig område…</Text>
          </View>
        )}

        {/* Selected feature detail */}
        {!loading && selectedFeature && (
          <>
            <View style={styles.detailHeader}>
              <Pressable
                onPress={() => setSelectedFeature(null)}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Tilbake til listen"
              >
                <Text style={styles.backArrow}>←</Text>
                <Text style={styles.backText}>Tilbake</Text>
              </Pressable>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {groupLabel(selectedFeature)}
              </Text>
              <View style={styles.backSpacer} />
            </View>
            <FeatureDetail feature={selectedFeature} />
          </>
        )}

        {/* Grouped list (hidden when detail visible) */}
        {!loading && !selectedFeature && (
          <>

            {/* Filter chips */}
            {groupNames.length > 0 && (
          <ScrollView
            horizontal
            style={styles.chipRow}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContent}
          >
            <Pressable
              style={[styles.chip, !filter && styles.chipActive]}
              onPress={() => setFilter(null)}
              accessibilityRole="button"
              accessibilityLabel={filter === null ? 'Valgt: Alle typer' : 'Vis alle typer'}
            >
              <Text
                style={[styles.chipText, !filter && styles.chipTextActive]}
              >
                Alle ({totalCount})
              </Text>
            </Pressable>
            {groupNames.map((name) => (
              <Pressable
                key={name}
                style={[styles.chip, filter === name && styles.chipActive]}
                onPress={() => setFilter(filter === name ? null : name)}
                accessibilityRole="button"
                accessibilityLabel={
                  filter === name ? `Fjern filter: ${name}` : `Filtrer på: ${name}`
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    filter === name && styles.chipTextActive,
                  ]}
                >
                  {name} (
                  {grouped.find((g) => g[0] === name)?.[1].length ?? 0})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Empty state */}
        {totalCount === 0 && (
          <Text style={styles.emptyText}>
            Ingen objekter funnet i kartvisningen.{'\n\n'}
            Zoom inn på et område for å skanne kartlagte elementer, eller slå på
            flere kartlag i innstillinger.
          </Text>
        )}

        {/* Grouped list */}
        {totalCount > 0 && (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
          >
            {visibleGroups.map(([name, feats]) => {
              const isOpen = expanded.has(name);
              return (
                <View key={name} style={styles.group}>
                  <Pressable
                    style={styles.groupHeader}
                    onPress={() => toggleGroup(name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isOpen ? 'Skjul' : 'Vis'} ${name} (${feats.length})`}
                  >
                    <Text style={[styles.arrow, isOpen && styles.arrowOpen]}>
                      ▶
                    </Text>
                    <Text style={styles.groupTitle}>{esc(name)}</Text>
                    <Text style={styles.groupCount}>{feats.length}</Text>
                  </Pressable>
                  {isOpen &&
                    feats.map((feat) => (
                      <Pressable
                        key={`${feat.layerName}::${feat.featureId}`}
                        style={({ pressed }) => [
                          styles.featRow,
                          pressed && styles.featRowPressed,
                        ]}
                        onPress={() => setSelectedFeature(feat)}
                        accessibilityRole="button"
                        accessibilityLabel={`Se detaljer for ${groupLabel(feat)}`}
                      >
                        <Text style={styles.featName}>{groupLabel(feat)}</Text>
                        {[...feat.props.entries()]
                          .filter(
                            ([k]) =>
                              !/^bildefil|objid|lokalid|featureid/i.test(k),
                          )
                          .slice(0, 2)
                          .map(([k, v]) => (
                            <Text key={k} style={styles.featDetail}>
                              {esc(k)}: {esc(v)}
                            </Text>
                          ))}
                        <Text style={styles.featHint}>Trykk for full info</Text>
                      </Pressable>
                    ))}
                </View>
              );
            })}
          </ScrollView>
        )}
      </>
        )}
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
    width: '90%',
    maxWidth: 520,
    maxHeight: '90%',
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
    flex: 1,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  chipRow: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.4)',
  },
  chipContent: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(58,80,104,0.25)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(255,179,0,0.18)',
    borderColor: MapTheme.amber,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '500',
    color: MapColors.mutedText,
  },
  chipTextActive: {
    color: MapTheme.amber,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  group: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.3)',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
  },
  arrow: {
    fontSize: 10,
    color: MapColors.mutedText,
    width: 13,
  },
  arrowOpen: {
    color: MapTheme.amber,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: MapColors.bodyText,
    flex: 1,
  },
  groupCount: {
    fontSize: 11,
    color: MapColors.mutedText,
    fontWeight: '500',
  },
  featRow: {
    paddingLeft: 40,
    paddingRight: 16,
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(58,80,104,0.3)',
    marginBottom: 1,
  },
  featRowPressed: {
    backgroundColor: 'rgba(232,160,32,0.1)',
    borderLeftColor: MapTheme.amber,
  },
  featName: {
    fontSize: 12,
    fontWeight: '500',
    color: MapColors.whiteText,
  },
  featDetail: {
    fontSize: 11,
    color: MapColors.mutedText,
    marginTop: 1,
  },
  featHint: {
    fontSize: 10,
    color: MapTheme.amber,
    marginTop: 4,
    fontStyle: 'italic',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  backButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backArrow: {
    fontSize: 14,
    color: MapTheme.amber,
  },
  backText: {
    fontSize: 12,
    color: MapTheme.amber,
    fontWeight: '500',
  },
  backSpacer: {
    width: 70,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: MapColors.divider,
  },
  detailTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: MapColors.bodyText,
    flex: 1,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: MapColors.mutedText,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
  },
});
