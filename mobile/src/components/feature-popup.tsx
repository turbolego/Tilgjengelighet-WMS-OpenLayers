import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MapColors } from '@/constants/map-theme';
import { esc } from '@/utils/map-api';
import type { FeatureInfo } from '@/constants/map-config';

export interface FeaturePopupProps {
  visible: boolean;
  onClose: () => void;
  loading?: boolean;
  title?: string;
  features?: FeatureInfo[];
}

function FeatureDetail({ feature }: { feature: FeatureInfo }) {
  return (
    <ScrollView
      style={styles.scrollBody}
      contentContainerStyle={styles.scrollContent}
      accessibilityLabel="Stedsdetaljer"
      accessibilityHint="Sveip for å høre egenskaper"
      accessibilityLiveRegion="polite"
    >
      {/* Layer reference */}
      {feature.layerName && (
        <Text style={styles.layerLabel} accessibilityRole="header">
          {esc(feature.layerName)}
          {feature.featureId ? ` · #${esc(feature.featureId)}` : ''}
        </Text>
      )}

      {/* Property table */}
      <View style={styles.table}>
        {[...feature.props.entries()]
          .filter(([k, v]) => !/^bildefil[123]$/i.test(k) && v)
          .map(([key, value]) => (
            <View
              key={key}
              style={styles.tableRow}
              accessible
              accessibilityLabel={`${key}: ${value}`}
            >
              <Text style={styles.tableKey}>{esc(key)}</Text>
              <Text style={styles.tableValue}>{esc(value)}</Text>
            </View>
          ))}
      </View>

      {/* Images — Geonorge has decommissioned the image serving endpoint.
          bildefil filenames still exist in WFS data but are not accessible
          via public HTTP. The old endpoint was:
          https://wfs.geonorge.no/skwfs/tilgjengelighet/bilder/ */}
      {feature.images.length > 0 && (
        <View style={styles.imageSection}>
          <Text style={styles.sectionTitle}>Bilder</Text>
          <Text style={styles.imageUnavailable}>
            Bildene (bildefil) er ikke lenger tilgjengelige via Geonorges
            API. De tidligere filene: {feature.images.slice(0, 3).join(', ')}
            {feature.images.length > 3 && ` og ${feature.images.length - 3} til`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/** Human-readable label for a feature in the picker list */
function featureLabel(f: FeatureInfo): string {
  const navn = f.props.get('navn') || f.props.get('navn:friluftsliv') || f.props.get('navn:vatn');
  const type = f.props.get('tilretteleggingsgrad') || f.props.get('kategori') || f.props.get('objecttype');
  const parts: string[] = [];
  if (navn) parts.push(esc(navn));
  if (type) parts.push(esc(type));
  if (parts.length === 0) {
    const firstProp = [...f.props.entries()].find(([, v]) => v);
    parts.push(firstProp ? esc(firstProp[1]) : f.layerName || 'Objekt');
  }
  const layer = f.layerName ? esc(f.layerName.replace(/^app:/, '')) : '';
  return parts.join(' · ') + (layer ? `\n[${layer}]` : '');
}

function FeaturePicker({
  features,
  onSelect,
}: {
  features: FeatureInfo[];
  onSelect: (f: FeatureInfo, idx: number) => void;
}) {
  return (
    <ScrollView
      style={styles.pickerList}
      contentContainerStyle={styles.pickerContent}
    >
      <Text style={styles.pickerHint}>
        {features.length} {features.length === 1 ? 'objekt funnet' : 'objekter funnet'}. Velg for å se detaljer:
      </Text>
      {features.map((f, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [
            styles.pickerRow,
            pressed && styles.pickerRowPressed,
          ]}
          onPress={() => onSelect(f, i)}
          accessibilityRole="button"
          accessibilityLabel={`Se ${featureLabel(f).replace(/\n/g, ', ')}`}
        >
          <Text style={styles.pickerIcon}>📌</Text>
          <Text style={styles.pickerLabel}>{featureLabel(f)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function FeaturePopup({
  visible,
  onClose,
  loading = false,
  title,
  features = [],
}: FeaturePopupProps) {
  const meaningful = features.filter((f) => f.props.size > 0);
  const autoSelected = meaningful.length === 1 ? meaningful[0] : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      aria-label="Stedsinfo"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Lukk stedsinfo"
        accessibilityHint="Trykk for å lukke"
        accessibilityRole="button"
      >
        <View />
      </Pressable>
      <View style={styles.panel}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title ?? 'Stedsinfo'}
          </Text>
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Lukk vindu"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        {/* Mount/unmount stateful content with the popup lifecycle */}
        {visible && (
          <PopupContent
            loading={loading}
            meaningful={meaningful}
            autoSelected={autoSelected}
          />
        )}
      </View>
    </Modal>
  );
}

/** Inner component that mounts/unmounts with the popup, resetting state naturally */
function PopupContent({
  loading,
  meaningful,
  autoSelected,
}: {
  loading: boolean;
  meaningful: FeatureInfo[];
  autoSelected: FeatureInfo | null;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const selected = selectedIdx != null ? meaningful[selectedIdx] : null;
  const displayFeature = selected ?? autoSelected;

  return (
    <>
      {loading && <Text style={styles.loadingText}>Laster ...</Text>}
      {!loading && meaningful.length === 0 && (
        <Text style={styles.emptyText}>Ingen data funnet.</Text>
      )}

      {/* Picker or detail */}
      {!loading && meaningful.length > 0 && !displayFeature && (
        <FeaturePicker
          features={meaningful}
          onSelect={(_f, idx) => setSelectedIdx(idx)}
        />
      )}
      {!loading && displayFeature && <FeatureDetail feature={displayFeature} />}
    </>
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
  // ── Picker ──────────────────────────────────────────────
  pickerList: {
    flex: 1,
  },
  pickerContent: {
    padding: 16,
  },
  pickerHint: {
    fontSize: 12,
    color: MapColors.mutedText,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  pickerRowPressed: {
    backgroundColor: 'rgba(232,160,32,0.1)',
    borderColor: MapColors.accent,
  },
  pickerIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  pickerLabel: {
    fontSize: 13,
    color: MapColors.bodyText,
    flex: 1,
    lineHeight: 18,
  },
  // ── Detail view ─────────────────────────────────────────
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
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: MapColors.divider,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: MapColors.bodyText,
    marginBottom: 4,
  },
  imageUnavailable: {
    fontSize: 12,
    color: MapColors.mutedText,
    lineHeight: 16,
  },
});