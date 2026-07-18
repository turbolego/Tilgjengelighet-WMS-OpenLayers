# Map Feature List & Search Modal Refactor — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the multi-feature popup with a single-feature detail popup, add a new "feature list" modal showing viewport-visible objects, and move search into its own modal.

**Architecture:** Three distinct modals driven from `index.tsx`: 1) **FeaturePopup** — shows details for ONE clicked feature only (tap → popup). 2) **FeatureListModal** — NEW modal that scans the viewport for features, groups them by type with expandable accordion sections and filter chips. 3) **SearchModal** — extracted place search from SettingsPanel into a standalone modal with magnifying glass button on ActionBar.

**Tech Stack:** React Native + MapLibre RN + Expo SDK 57, TypeScript, the existing Geonorge WMS endpoints.

---

## Pre-requisite Understanding

### Current flow (what changes):
- **ActionBar**: `🔍` → `handleQueryCenter` → queries ALL nearby features → opens FeaturePopup with chip tabs
- **Map press**: Same GetFeatureInfo multi-feature query
- **Search**: Currently inside SettingsPanel — will move out

### New flow (target):
1. **Tap a single feature**: FeaturePopup shows ONLY that one feature's info. No chips, no tabs.
2. **"List" button** (mapped to ActionBar `🔍` → now opens a different modal): FeatureListModal that scans the viewport for all feature types, grouped by type with toggleable accordion + filter.
3. **Search button** (`🔎` new button next to ⚙): Opens SearchModal (extracted from SettingsPanel).

### Viewport scanning approach
`handleHighscore` already does grid-based scan — we follow the same approach for the FeatureListModal: partition the viewport into a grid and `GetFeatureInfo` each cell. We then GROUP by `objekttypenavn` / layer name and present an expandable list.

---

## Task 1: Extend `map-api.ts` with viewport feature scan

**Objective:** Add a new function `scanViewportFeatures(extent, activeLayers)` that queries the full viewport.

**Files:**
- Modify: `mobile/src/utils/map-api.ts`

**Code:**

```ts
// Add after scanForHighscoreData — same pattern but uses text/plain
export async function scanViewportFeatures(
  extent: { xMin: number; yMin: number; xMax: number; yMax: number },
  activeLayers: string[],
): Promise<FeatureInfo[]> {
  const gridSize = 6; // 6x6 = 36 cells
  const xStep = (extent.xMax - extent.xMin) / gridSize;
  const yStep = (extent.yMax - extent.yMin) / gridSize;

  const deduped = new Map<string, FeatureInfo>();

  const queryLayers = activeLayers.length > 0 ? activeLayers.join(',') : 'tilgjengelighet3';
  const requests: string[] = [];

  for (let xi = 0; xi < gridSize; xi++) {
    for (let yi = 0; yi < gridSize; yi++) {
      const cx = extent.xMin + (xi + 0.5) * xStep;
      const cy = extent.yMin + (yi + 0.5) * yStep;
      const cellW = xStep * 0.6;
      const cellH = yStep * 0.6;

      const bbox = `${cx - cellW},${cy - cellH},${cx + cellW},${cy + cellH}`;

      const params = new URLSearchParams({
        REQUEST: 'GetFeatureInfo',
        SERVICE: 'WMS',
        VERSION: '1.3.0',
        LAYERS: queryLayers,
        QUERY_LAYERS: queryLayers,
        INFO_FORMAT: 'text/plain',
        FEATURE_COUNT: '20',
        I: '2',
        J: '2',
        WIDTH: '5',
        HEIGHT: '5',
        CRS: 'EPSG:4326',
        BBOX: bbox,
        language: 'Norwegian',
      });

      requests.push(`${WMS_URL}?${params.toString()}`);
    }
  }

  // Execute in batches of 8
  const batchSize = 8;
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const responses = await Promise.allSettled(
      batch.map((url) => fetch(url).then((r) => r.text())),
    );

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      const text = result.value;
      if (!text.trim()) continue;
      try {
        const features = parseFeatureInfoText(text);
        for (const feat of features) {
          if (feat.props.size === 0) continue;
          const key = `${feat.layerName}::${feat.featureId}`;
          if (!deduped.has(key)) {
            deduped.set(key, feat);
          }
        }
      } catch {
        // skip malformed responses
      }
    }
  }

  return [...deduped.values()];
}
```

**Verification:** Run `npx tsc --noEmit`, ensure no type errors.

---

## Task 2: Create SearchModal component

**Objective:** Extract the place search UI from SettingsPanel into a standalone modal.

**Files:**
- Create: `mobile/src/components/search-modal.tsx`

**New file content:**

```tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MapColors } from '@/constants/map-theme';
import type { PlaceResult } from '@/utils/map-api';

export interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSearchPlace: (query: string) => Promise<PlaceResult[]>;
  onSelectPlace: (place: PlaceResult) => void;
}

export function SearchModal({
  visible,
  onClose,
  onSearchPlace,
  onSelectPlace,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setError('');
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const r = await onSearchPlace(trimmed);
        setResults(r);
        setError('');
      } catch (err: any) {
        setResults([]);
        setError(err.message ?? 'Feil ved søk.');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearchPlace]);

  const handleSelect = (place: PlaceResult) => {
    onSelectPlace(place);
    setQuery('');
    setResults([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      aria-label="Søk sted"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Lukk søk"
        accessibilityHint="Trykk for å lukke"
        accessibilityRole="button"
      >
        <View />
      </Pressable>
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>🔎 Søk</Text>
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

        <View style={styles.body}>
          <TextInput
            style={styles.input}
            placeholder="Skriv inn stedsnavn..."
            placeholderTextColor="#6b7c8e"
            value={query}
            onChangeText={setQuery}
            autoComplete="off"
            autoCorrect={false}
            accessibilityLabel="Søk etter sted"
            accessibilityHint="Skriv minst tre tegn for å søke etter stedsnavn"
          />
          {error !== '' && <Text style={styles.error}>{error}</Text>}
          <ScrollView>
            {results.map((place, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.resultItem,
                  pressed && styles.resultItemPressed,
                ]}
                onPress={() => handleSelect(place)}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} — ${place.municipality}`}
              >
                <Text style={styles.resultName}>{place.name}</Text>
                <Text style={styles.resultMuni}>{place.municipality}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    width: '90%', maxWidth: 480, maxHeight: '80%',
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#3a5068',
    borderRadius: 14, overflow: 'hidden', alignSelf: 'center',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(58,80,104,0.5)',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#f0f4f8' },
  closeButton: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: '#3a5068', borderRadius: 8,
  },
  closeButtonText: { fontSize: 14, color: '#8aa3b8' },
  closeButtonPressed: { backgroundColor: 'rgba(255,255,255,0.15)' },
  body: { padding: 18, flex: 1 },
  input: {
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#3a5068',
    borderRadius: 8, color: '#c8d2da', fontSize: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10,
  },
  error: { color: '#e05555', fontSize: 12, marginBottom: 8 },
  resultItem: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(58,80,104,0.4)', borderRadius: 8,
  },
  resultItemPressed: { backgroundColor: 'rgba(58,80,104,0.3)' },
  resultName: { fontSize: 14, fontWeight: '600', color: '#f0f4f8' },
  resultMuni: { fontSize: 12, color: '#8aa3b8', marginTop: 2 },
});
```

---

## Task 3: Create FeatureListModal component

**Files:**
- Create: `mobile/src/components/feature-list-modal.tsx`

This is the large modal that replaces the old 🔍 button's popup. It displays a list of features currently in the viewport, organized as grouped items with filter chips and expandable sections.

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
import { esc } from '@/utils/map-api';
import type { FeatureInfo } from '@/constants/map-config';

export interface FeatureListModalProps {
  visible: boolean;
  onClose: () => void;
  loading: boolean;
  features: FeatureInfo[];
}

/** Extract a type label for grouping. */
function groupKey(feat: FeatureInfo): string {
  const keys = ['objekttypenavn', 'objtype', 'type', 'kategori'];
  for (const k of keys) {
    const v = feat.props.get(k);
    if (v && v.trim() !== '') return v.trim();
  }
  return feat.layerName || 'Annet';
}

export function FeatureListModal({
  visible, onClose, loading, features,
}: FeatureListPopupProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string | null>(null);

  // Group features by object type
  const grouped = useMemo(() => {
    const map = new Map<string, FeatureInfo[]>();
    for (const f of features) {
      if (f.props.size === 0) continue;
      const key = groupKey(f);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    // Sort groups alphabetically
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'no'));
  }, [features]);

  // Unique group names for filter chips
  const groupNames = useMemo(() => grouped.map(([name]) => name), [grouped]);

  // Filtered visible groups
  const visibleGroups = filter
    ? grouped.filter(([name]) => {
        // Match filter: exact type name or layer name that contains it
        return name === filter || features.some(f => groupKey(f) === name && f.layerName?.includes(filter!));
      })
    : grouped;

  const toggle = useCallback((name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const totalCount = features.filter(f => f.props.size > 0).length;

  return (
    <Modal
      visible={visible} transparent animationType="fade"
      onRequestClose={onClose} aria-label="Objekter i kartet"
    >
      <Pressable
        style={styles.backdrop} onPress={onClose}
        accessibilityLabel="Lukk objektliste" accessibilityHint="Trykk for å lukke"
        accessibilityRole="button"
      >
        <View />
      </Pressable>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>📋 {loading ? 'Skanner...' : `${totalCount} objekter i kartet`}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            accessibilityRole="button" accessibilityLabel="Lukk vindu"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Loading spinner */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={MapTheme.amber} />
            <Text style={styles.loadingText}>Skaler kartet...</Text>
          </View>
        )}

        {/* Filter chips */}
        {!loading && groupNames.length > 0 && (
          <ScrollView
            horizontal style={styles.chipRow}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipContent}
          >
            <Pressable
              style={[styles.chip, !filter && styles.chipActive]}
              onPress={() => setFilter(null)}
              accessibilityRole="button"
              accessibilityLabel="Resetter: vis alle typer"
            >
              <Text style={[styles.chipText, !filter && styles.chipTextActive]}>
                Alle ({totalCount})
              </Text>
            </Pressable>
            {groupNames.map(name => (
              <Pressable
                key={name}
                style={[styles.chip, filter === name && styles.chipActive]}
                onPress={() => setFilter(filter === name ? null : name)}
                accessibilityRole="button"
                accessibilityLabel={name}
              >
                <Text style={[styles.chipText, filter === name && styles.chipTextActive]}>
                  {name} ({grouped.find(g => g[0] === name)?.[1].length ?? 0})
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Empty state */}
        {!loading && features.length === 0 && (
          <Text style={styles.emptyText}>
            Ingen objekter funnet i kartvisningen.{'\n\n'}
            Zoom inn på et område for å skanne kartlagte elementer.
          </Text>
        )}

        {/* Grouped list */}
        {!loading && (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {visibleGroups.map(([name, feats]) => {
              const isOpen = expanded.has(name);
              return (
                <View key={name} style={styles.group}>
                  <Pressable
                    style={styles.groupHeader}
                    onPress={() => toggle(name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${isOpen ? 'Lukk' : 'Åpne'} gruppe: ${name} (${feats.length})`}
                  >
                    <Text style={[styles.arrow, isOpen && styles.arrowOpen]}>▶</Text>
                    <Text style={styles.groupTitle}>{esc(name)}</Text>
                    <Text style={styles.groupCount}>{feats.length}</Text>
                  </Pressable>
                  {isOpen && feats.map((feat, i) => (
                    <View key={i} style={styles.featRow} accessibilityLabel={groupKey(feat)}>
                      <Text style={styles.featName}>{groupKey(feat)}</Text>
                      {/* Show last non-trivial property as short description */}
                      {[...feat.props.entries()]
                        .filter(([k]) => !/^bildefil|objid|lokalid|featureid/i.test(k))
                        .slice(0, 1)
                        .map(([k, v]) => (
                          <Text key={k} style={styles.featDetail}>{esc(k)}: {esc(v)}</Text>
                        ))}
                    </View>
                  ))}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  panel: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    width: '90%', maxWidth: 520, maxHeight: '90%',
    backgroundColor: '#0d1117', borderWidth: 1, borderColor: '#3a5068',
    borderRadius: 14, overflow: 'hidden', alignSelf: 'center',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(58,80,104,0.5)',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#f0f4f8', flex: 1 },
  closeBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: '#3a5068', borderRadius: 8,
  },
  closeBtnPressed: { backgroundColor: 'rgba(255,255,255,0.15)' },
  closeBtnText: { fontSize: 14, color: '#8aa3b8' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  loadingText: { fontSize: 13, color: '#8aa3b8' },
  chipRow: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: 'rgba(58,80,104,0.4)' },
  chipContent: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14,
    backgroundColor: 'rgba(58,80,104,0.25)', borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: 'rgba(255,179,0,0.18)', borderColor: '#ecaa30',
  },
  chipText: { fontSize: 11, fontWeight: '500', color: '#8aa3b8' },
  chipTextActive: { color: '#ecaa30', fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  group: { borderBottomWidth: 1, borderBottomColor: 'rgba(58,80,104,0.3)' },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10,
    gap: 8,
  },
  arrow: { fontSize: 10, color: '#8aa3b8', width: 13 },
  arrowOpen: { transform: [{ rotate: '90deg' }], color: '#ecaa30' },
  groupName: { fontSize: 13, fontWeight: '600', color: '#c0cdda', flex: 1 },
  groupCount: { fontSize: 11, color: '#8aa3b8', fontWeight: '500' },
  featRow: { paddingLeft: 40, paddingRight: 16, paddingVertical: 6 },
  featName: { fontSize: 12, fontWeight: '500', color: '#d0d8e0' },
  featDetail: { fontSize: 11, color: '#8aa3b8', marginTop: 1 },
  emptyText: { fontSize: 13, color: '#8aa3b8', fontStyle: 'italic', textAlign: 'center', padding: 24 },
});
```

---

## Task 4: Simplify FeaturePopup — show only one selected feature

**Objective:** Remove the dift picker (chips/tabs) from FeaturePopup because clicking a map feature now shows only that one feature. If `features` array has items, only show the first one.

**Files:**
- Modify: `mobile/src/components/feature-popup.tsx`

**Changes:**
1. Remove all picker chip code (lines ~108-143 in current file: the `meaningful.length > 1` block)
2. Remove `preserveIndex`, just use `features` as is — first valid feature
3. Keep the header, loading, empty, and detail sections intact
4. Remove chip-related CSS styles: `pickerRow`, `pickerContent`, `pickerChip`, `pickerChipActive`, `pickerChipText`, `pickerChipTextActive`

**Replace** the JSX from line ~105 to ~206 with simplified version:

```tsx
        {/* Detail — only one selected feature */}
        {!loading && selected && (
          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            accessibilityLabel="Stedsdetaljer"
            accessibilityHint="Sveip for å høre egenskaper"
            accessibilityLiveRegion="polite"
          >
            {/* Layer reference */}
            {selected.layerLayer && (
              <Text style={styles.layerLabel} accessibilityRole="header">
                {esc(selected.layerName)}
                {selected.featureId ? ` · #${esc(selected.featureId)}` : ''}
              </Text>
            )}

            {/* Property table */}
            <View style={styles.table}>
              {[...selected.props.entries()]
                .filter(([k, v]) => !/^bildefil[123]$/i.test(k) && v)
                .map(([key, value]) => (
                  <View key={key} style={styles.tableRow} accessible accessibilityLabel={`${key}: ${value}`}>
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
                        accessibilityLabel={`Photo: ${filename}`}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
```

**Remove styles:** Delete `pickerRow`, `pickerContent`, `pickerChip`, `pickerChipActive`, `pickerChipText`, `pickerChipTextActive` from the StyleSheet.

---

## Task 5: Update ActionBar — new list button + default search button

**Objective:** 
- Replace the `🔍` button with `📋` (list) that opens FeatureListModal
- Add new `🔎` (magnifying glass) button for SearchModal, placed next to ⚙
- Remove the old `onQueryCenter` handler since 🔍 is replaced

**Files:**
- Modify: `mobile/src/components/action-bar.tsx`

**Props changes:**
```ts
export interface ActionBarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onGPS: () => void;
  onHighscore: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;       // NEW — magnifying glass
  onOpenFeatureList: () => void;  // RENAMED — was onFilterCenter
  gpsLoading?: boolean;
}
```

**Button layout (bottom of ActionBar):**
```tsx
<View style={styles.divider} />
<MapButton label="📋" a11yLabel="Vis objekter i kartet" onPress={onOpenFeatureList} />
<View style={styles.divider} />
<MapButton label="🔎" a11yLabel="Søk stedsnavn" onPress={onOpenSearch} />
<MapButton label="⚙" a11yLabel="Innstillinger" onPress={onOpenSettings} accent />
```

---

## Task 6: Wire everything together in index.tsx

**Files:**
- Modify: `mobile/src/app/(tabs)/index.tsx`

**Imports:**
```ts
import { ActionBar } from '@/components/action-bar';
import { FeatureListModal } from '@/components/feature-list-modal';
import { SearchModal } from '@/components/search-modal';
import { scanViewportFeatures } from '@/utils/map-api';
```

**New state:**
```ts
const [featureListVisible, setFeatureListVisible] = useState(false);
const [featureListLoading, setFeatureListLoading] = useState(false);
const [featureListFeatures, setFeatureListFeatures] = useState<FeatureInfo[]>([]);
const [searchVisible, setSearchVisible] = useState(false);
```

**New handler — throttle the list modal on each viewport event:**
```ts
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
```

**Update ActionBar props:**
```tsx
<ActionBar
  ...
  onOpenSearch={() => setSearchVisible(true)}
  onOpenFeatureList={handleOpenFeatureList}
  ...
/>
```

**Hide overlays when featureListVisible or searchVisible:**
```tsx
{!settingsVisible && !popupVisible && !highscoreVisible && !featureListVisible && !searchVisible && (
  …
)}

{/* Modals — add three new ones after existing */}

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
```

**Hide old Search from SettingsPanel — just remove the search section from settings-panel.tsx** (Task 7).

---

## Task 7: Remove search from SettingsPanel

**Files:**
- Modify: `mobile/src/components/settings-panel.tsx`

**Removals:**
1. Remove `onSearchPlace` and `onSelectPlace` from `SettingsPanelProps`
2. Remove the entire `{/* Place search */}` section (lines ~104-146)
3. Remove `PlaceResult` import and internal search state (`searchQuery`, `searchResults`, `searchError`)
4. Remove search-related styles: `searchInput`, `searchResultsList`, `searchResultItem`, `searchResultItemPressed`, `searchResultText`, `errorText`
5. In `index.tsx`, stop passing `onSearchPlace` and `onSelectPlace` to `<SettingsPanel>`

---

## Task 8: Assert both tests pass

**Verification:**
```bash
cd mobile && npx tsc --noEmit
cd mobile && npx expo export --platform web && npx playwright test
```

Expected: all `chromium` tests + all `chromium-a11y` tests passing (24 tests).

Any tests expecting multi-feature info popup behavior (feature picker chip count) must be updated to expect single-feature popup.

---

## Risk

- **Viewport scanning may be slow over large areas** — Keeping grid size 6x6 (36 cells) with batch size 8 is acceptable (≈4 requests at a time). The user sees a loading spinner.
- **Objektypenavn not in Geonorge data** — Fallback chaining: layerName → 'Utgitt'.

---

## Task Order Summary

| # | What | Time |
|---|---|---|
| 1 | `scanViewportFeatures` in `map-api.ts` | 5 min |
| 2 | `search-modal.tsx` — new component | 3 min |
| 3 | `feature-list-modal.tsx` — new component | 5 min |
| 4 | Simplify `feature-popup.tsx` — remove picker | 3 min |
| 5 | Update `action-bar.tsx` — two new buttons | 2 min |
| 6 | Wire in `index.tsx` — state, handlers, modals | 4 min |
| 7 | Remove search from `settings-panel.tsx` | 2 min |
| 8 | Verify TS + Playwright | 2 min |