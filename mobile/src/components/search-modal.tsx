import React, { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';
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
        {/* Header */}
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
            placeholder="Skriv inn stedsnavn…"
            placeholderTextColor={MapTheme.mist}
            value={query}
            onChangeText={handleQueryChange}
            autoComplete="off"
            autoCorrect={false}
            accessibilityLabel="Søk etter sted"
            accessibilityHint="Skriv minst tre tegn for å søke etter stedsnavn"
          />
          {error !== '' && <Text style={styles.error}>{error}</Text>}
          <ScrollView>
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
    maxWidth: 480,
    maxHeight: '80%',
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
  input: {
    backgroundColor: MapTheme.ink,
    borderWidth: 1,
    borderColor: MapColors.border,
    borderRadius: 8,
    color: MapColors.bodyText,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
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
});
