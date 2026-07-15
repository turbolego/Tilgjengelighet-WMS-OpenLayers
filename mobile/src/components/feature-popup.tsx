import React from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
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

export function FeaturePopup({
  visible,
  onClose,
  loading = false,
  title,
  features = [],
}: FeaturePopupProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={styles.panel}>
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

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <Text style={styles.loadingText}>Henter stedsinfo…</Text>
            </View>
          ) : features.length === 0 ? (
            <Text style={styles.emptyText}>Ingen data funnet.</Text>
          ) : (
            features.map((feat, fi) => (
              <View key={`${feat.layerName}-${feat.featureId}-${fi}`}>
                {feat.layerName ? (
                  <Text style={styles.layerLabel}>
                    {esc(feat.layerName)}
                    {feat.featureId ? ` · #${esc(feat.featureId)}` : ''}
                  </Text>
                ) : null}

                {/* Property table */}
                <View style={styles.table}>
                  {[...feat.props.entries()]
                    .filter(([k, v]) => !/^bildefil[123]$/i.test(k) && v)
                    .map(([key, value]) => (
                      <View key={key} style={styles.tableRow}>
                        <Text style={styles.tableKey}>{esc(key)}</Text>
                        <Text style={styles.tableValue}>{esc(value)}</Text>
                      </View>
                    ))}
                </View>

                {/* Images */}
                {feat.images.length > 0 && (
                  <View style={styles.imageSection}>
                    {feat.images.map((filename: string, ii: number) => {
                      const src = `${IMAGE_BASE_URL}/${encodeURIComponent(filename)}`;
                      return (
                        <Pressable
                          key={ii}
                          onPress={() => Linking.openURL(src)}
                          style={[
                            styles.imageWrapper,
                            feat.images.length === 1 && styles.imageWrapperSingle,
                          ]}
                        >
                          <Image
                            source={{ uri: src }}
                            style={[
                              styles.image,
                              feat.images.length === 1 && styles.imageSingle,
                            ]}
                            resizeMode="cover"
                            accessibilityLabel={`Bilde: ${filename}`}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            ))
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
    margin: 'auto',
    width: '90%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: MapColors.surface,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: 'auto',
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
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  emptyText: {
    fontSize: 13,
    color: MapColors.mutedText,
    fontStyle: 'italic',
  },
  layerLabel: {
    fontSize: 11,
    color: MapColors.headingText,
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 2,
    fontWeight: '600',
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