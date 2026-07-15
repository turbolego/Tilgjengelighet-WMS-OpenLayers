import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  StatusBar,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { type LayerInfo } from '@/constants/map-config';
import { type PlaceResult } from '@/utils/map-api';

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
  onSearchPlace: (query: string) => Promise<PlaceResult[]>;
  onSelectPlace: (place: PlaceResult) => void;
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
  onSearchPlace,
  onSelectPlace,
}: SettingsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [searchError, setSearchError] = useState('');

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 3) {
      setSearchResults([]);
      setSearchError('');
    }
  };

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const results = await onSearchPlace(searchQuery.trim());
        setSearchResults(results);
        setSearchError('');
      } catch (err: any) {
        setSearchResults([]);
        setSearchError(err.message ?? 'Feil ved søk.');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, onSearchPlace]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <Pressable style={styles.panelTouchGuard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.panel}>
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
            accessibilityLabel="Lukk innstillinger"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Place search */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Søk etter sted</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Skriv inn stedsnavn…"
              placeholderTextColor={MapTheme.mist}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoComplete="off"
              autoCorrect={false}
            />
            {searchError !== '' && (
              <Text style={styles.errorText}>{searchError}</Text>
            )}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsList}>
                {searchResults.map((place, i) => (
                  <Pressable
                    key={i}
                    style={({ pressed }) => [
                      styles.searchResultItem,
                      pressed && styles.searchResultItemPressed,
                    ]}
                    onPress={() => {
                      onSelectPlace(place);
                      setSearchQuery('');
                      setSearchResults([]);
                      onClose();
                    }}
                  >
                    <Text style={styles.searchResultText}>
                      {place.name} – {place.municipality}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

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
        </View>
          </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
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
  panelTouchGuard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
  },
  panel: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
    backgroundColor: MapColors.surface,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 14,
    overflow: 'hidden',
    // Center on screen
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
  searchInput: {
    width: '100%',
    backgroundColor: MapTheme.ink,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    color: MapColors.bodyText,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchResultsList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  searchResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.4)',
  },
  searchResultItemPressed: {
    backgroundColor: MapTheme.inkLight,
  },
  searchResultText: {
    fontSize: 13,
    color: MapColors.bodyText,
  },
  errorText: {
    color: MapTheme.redWarn,
    fontSize: 12,
    marginTop: 4,
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
    borderRadius: 3,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: MapColors.accent,
    borderColor: MapColors.accent,
  },
  checkmark: {
    fontSize: 9,
    color: MapTheme.ink,
    fontWeight: '700',
  },
  layerLabel: {
    fontSize: 13,
    color: MapColors.bodyText,
    lineHeight: 18,
    flex: 1,
  },
  layerLabelBold: {
    fontWeight: '600',
  },
  mutedText: {
    fontSize: 12,
    color: MapColors.mutedText,
    fontStyle: 'italic',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  groupArrow: {
    fontSize: 8,
    color: MapColors.mutedText,
  },
  groupArrowOpen: {
    transform: [{ rotate: '90deg' }],
  },
  groupTitle: {
    fontSize: 13,
    color: MapColors.bodyText,
    fontWeight: '600',
  },
  groupChildren: {
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: MapColors.divider,
    marginLeft: 6,
    flexDirection: 'column',
    gap: 1,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  radio: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1,
    borderColor: MapColors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: MapColors.accent,
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: MapColors.accent,
  },
  radioLabel: {
    fontSize: 13,
    color: MapColors.bodyText,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(58,80,104,0.4)',
  },
  footerText: {
    fontSize: 11,
    color: MapColors.mutedText,
  },
});