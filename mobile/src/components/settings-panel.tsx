import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { type LayerInfo } from '@/constants/map-config';
import { BUILD_VERSION, BUILD_DATE } from '@/constants/version';

export interface SettingsPanelProps {
  visible: boolean;
  onClose: () => void;
  layerTree: LayerInfo[];
  layersLoading: boolean;
  activeLayers: Set<string>;
  onLayerToggle: (name: string) => void;
  compositeVisible: boolean;
  onCompositeToggle: (visible: boolean) => void;
  basemap: 'osm' | 'topo' | 'none';
  onBasemapChange: (basemap: 'osm' | 'topo' | 'none') => void;
}

export function SettingsPanel({
  visible,
  onClose,
  layerTree,
  layersLoading,
  activeLayers,
  onLayerToggle,
  compositeVisible,
  onCompositeToggle,
  basemap,
  onBasemapChange,
}: SettingsPanelProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      aria-label="Innstillinger"
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Lukk innstillinger" accessibilityHint="Trykk for å lukke" accessibilityRole="button">
        <View />
      </Pressable>
      <View style={[styles.panel, { top: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Innstillinger</Text>
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

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Layer tree */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Kartlag</Text>
            <Text style={styles.sectionDesc}>
              Velg hvilke lag du vil vise på kartet.
            </Text>
            {layersLoading ? (
              <View style={styles.loadingRow}>
                <Text style={styles.loadingText}>Laster kartlag…</Text>
              </View>
            ) : (
              <View style={styles.layerTree}>
                {/* Composite toggle */}
                <View style={styles.layerItemComposite}>
                  <LayerCheckbox
                    label="Alle lag (sammensatt)"
                    checked={compositeVisible}
                    onToggle={() => onCompositeToggle(!compositeVisible)}
                    bold
                  />
                </View>
                <View style={styles.layerDivider} />
                {layerTree.length === 0 ? (
                  <Text style={styles.mutedText}>Ingen kartlag funnet.</Text>
                ) : (
                  layerTree.map((group) => (
                    <TreeNode
                      key={group.name || group.title}
                      node={group}
                      activeLayers={activeLayers}
                      onToggle={onLayerToggle}
                    />
                  ))
                )}
              </View>
            )}
          </View>

          {/* Basemap switcher */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Bakgrunnskart</Text>
            <BasemapRadio
              label="OpenStreetMap"
              value="osm"
              selected={basemap}
              onChange={onBasemapChange}
            />
            <BasemapRadio
              label="Topografisk (Kartverket)"
              value="topo"
              selected={basemap}
              onChange={onBasemapChange}
            />
            <BasemapRadio
              label="Ingen bakgrunn"
              value="none"
              selected={basemap}
              onChange={onBasemapChange}
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Kartverket / Geonorge · © Statens kartverk
          </Text>
          <Text style={styles.versionLine}>
            Build {BUILD_VERSION} · {BUILD_DATE}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

// ── Tree node (group + leaf) ────────────────────────────────────────────────

function TreeNode({
  node,
  activeLayers,
  onToggle,
}: {
  node: LayerInfo;
  activeLayers: Set<string>;
  onToggle: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const children = node.children.filter((c) => c.name);

  // Leaf node
  if (children.length === 0) {
    return (
      <LayerCheckbox
        label={node.title || node.name}
        checked={activeLayers.has(node.name)}
        onToggle={() => onToggle(node.name)}
      />
    );
  }

  // Group node
  return (
    <View>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.groupHeader}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Skjul' : 'Ekspander'} gruppe: ${node.title}`}
      >
        <Text style={[styles.groupArrow, expanded && styles.groupArrowOpen]}>
          ▶
        </Text>
        <Text style={styles.groupTitle}>{node.title}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.groupChildren}>
          {children.map((child) => (
            <TreeNode
              key={child.name || child.title}
              node={child}
              activeLayers={activeLayers}
              onToggle={onToggle}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Layer checkbox ──────────────────────────────────────────────────────────

function LayerCheckbox({
  label,
  checked,
  onToggle,
  bold = false,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  bold?: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.layerItem}
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityLabel={`Vis lag: ${label}`}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.layerLabel, bold && styles.layerLabelBold]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Basemap radio ───────────────────────────────────────────────────────────

function BasemapRadio({
  label,
  value,
  selected,
  onChange,
}: {
  label: string;
  value: 'osm' | 'topo' | 'none';
  selected: string;
  onChange: (v: 'osm' | 'topo' | 'none') => void;
}) {
  const isSelected = selected === value;
  return (
    <Pressable
      onPress={() => onChange(value)}
      style={styles.radioRow}
      accessibilityRole="radio"
      aria-checked={isSelected}
      accessibilityLabel={label}
    >
      <View style={[styles.radio, isSelected && styles.radioSelected]}>
        {isSelected && <View style={styles.radioDot} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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
    maxWidth: 480,
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
    paddingBottom: 16,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.4)',
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: MapColors.headingText,
    marginBottom: 10,
  },
  sectionDesc: {
    fontSize: 13,
    color: MapColors.mutedText,
    lineHeight: 20,
    marginBottom: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  loadingText: {
    fontSize: 13,
    color: MapColors.mutedText,
  },
  layerTree: {
    flexDirection: 'column',
  },
  layerItemComposite: {
    backgroundColor: 'rgba(232,160,32,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,160,32,0.2)',
    borderRadius: 8,
    marginBottom: 6,
  },
  layerDivider: {
    height: 1,
    backgroundColor: MapColors.divider,
    marginVertical: 6,
    opacity: 0.5,
  },
  layerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 9,
  },
  checkbox: {
    width: 15,
    height: 15,
    borderWidth: 1,
    borderColor: MapColors.divider,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: MapColors.accent,
    borderColor: MapColors.accent,
  },
  checkmark: {
    fontSize: 10,
    fontWeight: '700',
    color: MapTheme.ink,
  },
  layerLabel: {
    fontSize: 13,
    color: MapColors.bodyText,
    flex: 1,
    lineHeight: 20,
  },
  layerLabelBold: {
    fontWeight: '700',
    color: MapColors.whiteText,
  },
  mutedText: {
    fontSize: 12,
    color: MapColors.mutedText,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    gap: 6,
  },
  groupArrow: {
    fontSize: 10,
    color: MapColors.mutedText,
    transform: [{ rotate: '0deg' }],
    width: 14,
    textAlign: 'center',
  },
  groupArrowOpen: {
    transform: [{ rotate: '90deg' }],
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: MapColors.headingText,
    flex: 1,
  },
  groupChildren: {
    marginLeft: 14,
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(58,80,104,0.4)',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: MapColors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: MapColors.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: MapColors.accent,
  },
  radioLabel: {
    fontSize: 13,
    color: MapColors.bodyText,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(58,80,104,0.4)',
  },
  footerText: {
    fontSize: 11,
    color: MapColors.mutedText,
    textAlign: 'center',
  },
  versionLine: {
    fontSize: 10,
    color: '#c8d8e4',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: 'monospace',
  },
});
