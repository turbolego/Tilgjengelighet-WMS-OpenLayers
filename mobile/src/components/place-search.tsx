import React, { useState, useEffect, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
import type { PlaceResult } from '@/utils/map-api';

export interface PlaceSearchProps {
  /** Placeholder text for the search input */
  placeholder: string;
  /** Called with search results — parent provides the search function */
  onSearch: (query: string) => Promise<PlaceResult[]>;
  /** Called when user selects a place from search results */
  onSelect: (place: PlaceResult) => void;
  /** Optional pre-selected label (e.g. "Min posisjon") — shows a chip instead of search */
  selectedLabel?: string;
  /** Optional subtitle for selected chip (municipality name) */
  selectedSubtitle?: string;
  /** Called to clear selection and return to search mode */
  onClearSelection?: () => void;
  /** When true, shows a disabled "Min posisjon" state */
  myLocationUnavailable?: boolean;
  /** Optional bottom action button label (e.g. "Min posisjon") */
  actionLabel?: string;
  /** Called when bottom action button is pressed */
  onAction?: () => void;
  /** Whether the bottom action should show as selected */
  actionActive?: boolean;
  /** Accessibility label for the search input */
  a11yLabel?: string;
  /** Accessibility hint for the search input */
  a11yHint?: string;
}

export function PlaceSearch({
  placeholder,
  onSearch,
  onSelect,
  selectedLabel,
  selectedSubtitle,
  onClearSelection,
  myLocationUnavailable = false,
  actionLabel,
  onAction,
  actionActive = false,
  a11yLabel = 'Søk etter sted',
  a11yHint = 'Skriv minst tre tegn for å søke etter stedsnavn',
}: PlaceSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState('');

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (text.trim().length < 3) {
      setResults([]);
      setError('');
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) return;
    const timer = setTimeout(async () => {
      try {
        const r = await onSearch(trimmed);
        setResults(r);
        setError('');
      } catch (err: any) {
        setResults([]);
        setError(err.message ?? 'Feil ved søk.');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleSelect = useCallback(
    (place: PlaceResult) => {
      onSelect(place);
      setQuery('');
      setResults([]);
      setError('');
    },
    [onSelect],
  );

  // ── Selected mode: show chip ──────────────────────────────────────────
  if (selectedLabel) {
    return (
      <View style={styles.selectedContainer}>
        <View style={styles.selectedChip}>
          <Text style={styles.selectedChipIcon}>
            {selectedLabel === 'Min posisjon' ? '📍' : '🗺️'}
          </Text>
          <View style={styles.selectedChipText}>
            <Text style={styles.selectedChipLabel} numberOfLines={1}>
              {selectedLabel}
            </Text>
            {selectedSubtitle ? (
              <Text style={styles.selectedChipSubtitle} numberOfLines={1}>
                {selectedSubtitle}
              </Text>
            ) : null}
          </View>
          {onClearSelection && (
            <Pressable
              onPress={onClearSelection}
              style={({ pressed }) => [
                styles.chipClearButton,
                pressed && styles.chipClearPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Fjern ${selectedLabel}`}
            >
              <Text style={styles.chipClearText}>✕</Text>
            </Pressable>
          )}
        </View>
        {actionLabel && !actionActive && onAction && (
          <Pressable
            onPress={onAction}
            style={({ pressed }) => [
              styles.actionButton,
              myLocationUnavailable && styles.actionButtonDisabled,
              pressed && styles.actionButtonPressed,
            ]}
            disabled={myLocationUnavailable}
            accessibilityRole="button"
            accessibilityLabel={
              myLocationUnavailable
                ? `${actionLabel} – posisjon utilgjengelig`
                : actionLabel
            }
          >
            <Text
              style={[
                styles.actionButtonText,
                myLocationUnavailable && styles.actionButtonTextDisabled,
              ]}
            >
              {myLocationUnavailable ? '📍 Ikke tilgjengelig' : actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── Action button shown as active/selected ───────────────────────────
  if (actionActive && actionLabel) {
    return (
      <View style={styles.actionActiveRow}>
        <Text style={styles.actionActiveIcon}>
          {actionLabel === 'Min posisjon' ? '📍' : '🗺️'}
        </Text>
        <Text style={styles.actionActiveLabel}>{actionLabel}</Text>
        {onClearSelection && (
          <Pressable
            onPress={onClearSelection}
            style={({ pressed }) => [
              styles.chipClearButton,
              pressed && styles.chipClearPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Fjern ${actionLabel}`}
          >
            <Text style={styles.chipClearText}>✕</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ── Search mode ──────────────────────────────────────────────────────
  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={MapTheme.mist}
        value={query}
        onChangeText={handleQueryChange}
        autoComplete="off"
        autoCorrect={false}
        accessibilityLabel={a11yLabel}
        accessibilityHint={a11yHint}
      />
      {actionLabel && onAction && !actionActive && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            myLocationUnavailable && styles.actionButtonDisabled,
            pressed && styles.actionButtonPressed,
          ]}
          disabled={myLocationUnavailable}
          accessibilityRole="button"
          accessibilityLabel={
            myLocationUnavailable
              ? `${actionLabel} – posisjon utilgjengelig`
              : actionLabel
          }
        >
          <Text
            style={[
              styles.actionButtonText,
              myLocationUnavailable && styles.actionButtonTextDisabled,
            ]}
          >
            {myLocationUnavailable
              ? '📍 Posisjon utilgjengelig'
              : `📍 ${actionLabel}`}
          </Text>
        </Pressable>
      )}
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      <ScrollView keyboardShouldPersistTaps="handled">
        {results.length === 0 && query.length >= 3 && (
          <Text style={styles.emptyText}>Ingen steder funnet.</Text>
        )}
        {results.map((place, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [
              styles.resultItem,
              pressed && styles.resultItemPressed,
            ]}
            onPress={() => handleSelect(place)}
            accessibilityRole="button"
            accessibilityLabel={`${place.name} – ${place.municipality}`}
          >
            <Text style={styles.resultName}>{place.name}</Text>
            <Text style={styles.resultMuni}>{place.municipality}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Search mode ──────────────────────────────────────────────────────
  input: {
    backgroundColor: MapTheme.ink,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    color: MapColors.bodyText,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  error: {
    color: MapTheme.redWarn,
    fontSize: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: MapColors.mutedText,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58,80,104,0.4)',
    borderRadius: 8,
  },
  resultItemPressed: {
    backgroundColor: MapTheme.inkLight,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: MapColors.whiteText,
  },
  resultMuni: {
    fontSize: 12,
    color: MapColors.mutedText,
    marginTop: 2,
  },

  // ── Selected mode (chip) ─────────────────────────────────────────────
  selectedContainer: {
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MapTheme.inkLight,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  selectedChipIcon: {
    fontSize: 16,
  },
  selectedChipText: {
    flex: 1,
  },
  selectedChipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: MapColors.whiteText,
  },
  selectedChipSubtitle: {
    fontSize: 11,
    color: MapColors.mutedText,
    marginTop: 1,
  },
  chipClearButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipClearPressed: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  chipClearText: {
    fontSize: 12,
    color: MapColors.mutedText,
  },

  // ── "Min posisjon" action button ────────────────────────────────────
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MapTheme.ink,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  actionButtonPressed: {
    backgroundColor: MapTheme.inkLight,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 13,
    color: MapColors.whiteText,
  },
  actionButtonTextDisabled: {
    color: MapColors.mutedText,
  },

  // ── Action active (selected my-location) ────────────────────────────
  actionActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MapTheme.inkLight,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  actionActiveIcon: {
    fontSize: 16,
  },
  actionActiveLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: MapColors.whiteText,
  },
});