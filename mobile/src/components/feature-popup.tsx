import React, { useState, useMemo } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { esc } from '@/utils/map-api';
import type { FeatureInfo } from '@/constants/map-config';
import { IMAGE_BASE_URL } from '@/constants/map-config';

export interface FeaturePopupProps {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  title?: string;
  features?: FeatureInfo[];
}

/**
 * Extract a human-readable label from a feature.
 * Uses the first meaningful property (not bildefil, not ID, not coordinate).
 */
function featureLabel(feat: FeatureInfo): string {
  // Try: type name, object type, or any classification field
  const labelKeys = [
    'objekttypenavn', 'objtype', 'type', 'navn', 'name',
    'objekttype', 'kategori', 'featuretype',
  ];
  for (const k of labelKeys) {
    const v = feat.props.get(k);
    if (v && v.trim() !== '') return v;
  }
  // Fallback: first non-trivial value
  for (const [k, v] of feat.props) {
    if (!/^bildefil|objid|lokalid|featureid/i.test(k) && v.trim() !== '') {
      return v;
    }
  }
  return feat.layerName || 'Ukjent objekt';
}

export function FeaturePopup({
  visible,
  onClose,
  loading = false,
  title,
  features = [],
}: FeaturePopupProps) {
  // Which feature is currently selected (index in features array)
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Only meaningful features (with actual data)
  const meaningful = useMemo(
    () => features.filter((f) => f.props.size > 0),
    [features],
  );
  // Clamp selectedIndex to valid range (derived — no setState in effect needed)
  const safeIndex = meaningful.length === 0
    ? 0
    : Math.min(selectedIndex, meaningful.length - 1);
  const selected = meaningful[safeIndex];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View />
      </Pressable>

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.panel}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title ?? 'Stedsinfo'}
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Lukk stedsinfo"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {/* Loading state */}
          {loading && (
            <View style={styles.loadingRow}>
              <Text style={styles.loadingText}>Henter stedsinfo…</Text>
            </View>
          )}

          {/* Empty state */}
          {!loading && meaningful.length === 0 && (
            <Text style={styles.emptyText}>Ingen data funnet.</Text>
          )}

          {/* Feature picker: multiple features? show tabs to choose one */}
          {!loading && meaningful.length > 0 && (
            <>
              {meaningful.length > 1 && (
                <ScrollView
                  horizontal
                  style={styles.pickerRow}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pickerContent}
                >
                  {meaningful.map((feat, i) => {
                    const label = featureLabel(feat);
                    const isActive = i === safeIndex;
                    return (
                      <Pressable
                        key={`${feat.layerName}-${feat.featureId}-${i}`}
                        style={[
                          styles.pickerChip,
                          isActive && styles.pickerChipActive,
                        ]}
                        onPress={() => setSelectedIndex(i)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text
                          style={[
                            styles.pickerChipText,
                            isActive && styles.pickerChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Selected feature detail */}
              {selected && (
                <ScrollView
                  style={styles.scrollBody}
                  contentContainerStyle={styles.scrollContent}
                >
                  {/* Layer reference */}
                  {selected.layerName && (
                    <Text style={styles.layerLabel}>
                      {esc(selected.layerName)}
                      {selected.featureId ? ` · #${esc(selected.featureId)}` : ''}
                    </Text>
                  )}

                  {/* Property table */}
                  <View style={styles.table}>
                    {[...selected.props.entries()]
                      .filter(([k, v]) => !/^bildefil[123]$/i.test(k) && v)
                      .map(([key, value]) => (
                        <View key={key} style={styles.tableRow}>
                          <Text style={styles.tableKey}>{esc(key)}</Text>
                          <Text style={styles.tableValue}>{esc(value)}</Text>
                        </View>
                      ))}
                  </View>

                  {/* Images */}
                  {selected.images.length > 0 && (
                    <View style={styles.imageSection}>
                      {selected.images.map((filename: string, ii: number) => {
                        const src = `${IMAGE_BASE_URL}/${encodeURIComponent(filename)}`;
                        return (
                          <Pressable
                            key={ii}
                            onPress={() => Linking.openURL(src)}
                            style={[
                              styles.imageWrapper,
                              selected.images.length === 1 && styles.imageWrapperSingle,
                            ]}
                          >
                            <Image
                              source={{ uri: src }}
                              style={[
                                styles.image,
                                selected.images.length === 1 && styles.imageSingle,
                              ]}
                              resizeMode="cover"
                              accessibilityLabel={`Bilde: ${filename}`}
                            />
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: MapColors.backdrop,
  },
  safeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    backgroundColor: MapColors.surface,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    marginRight: 8,
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
  },
  loadingText: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  emptyText: {
    fontSize: 13,
    color: MapColors.mutedText,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 24,
  },
  pickerRow: {
    maxHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: MapColors.divider,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(58,80,104,0.25)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pickerChipActive: {
    backgroundColor: 'rgba(255,179,0,0.18)',
    borderColor: MapTheme.amber,
  },
  pickerChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: MapColors.mutedText,
    maxWidth: 140,
  },
  pickerChipTextActive: {
    color: MapTheme.amber,
    fontWeight: '700',
  },
  layerLabel: {
    fontSize: 11,
    color: MapColors.headingText,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 2,
    fontWeight: '600',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  table: {
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: MapColors.divider,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableKey: {
    fontSize: 12,
    color: MapColors.mutedText,
    fontWeight: '500',
    width: '42%',
  },
  tableValue: {
    fontSize: 12,
    color: MapColors.bodyText,
    flex: 1,
  },
  imageSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: MapColors.divider,
  },
  imageWrapper: {
    width: '48%',
    maxWidth: 130,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: MapTheme.ink,
  },
  imageWrapperSingle: {
    width: '100%',
    maxWidth: '100%',
    height: 140,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageSingle: {
    height: 140,
  },
});