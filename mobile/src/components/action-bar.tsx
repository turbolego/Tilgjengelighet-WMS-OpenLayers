import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';

export interface ActionBarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onGPS: () => void;
  onHighscore: () => void;
  onOpenSettings: () => void;
  onOpenFeatureList: () => void;
  onOpenSearch: () => void;
  gpsLoading?: boolean;
}

const BTN_SIZE = 52;
export const ACTION_BAR_WIDTH = BTN_SIZE;

export function ActionBar({
  onZoomIn,
  onZoomOut,
  onResetView,
  onGPS,
  onHighscore,
  onOpenSettings,
  onOpenFeatureList,
  onOpenSearch,
  gpsLoading = false,
}: ActionBarProps) {
  return (
    <View style={styles.container}>
      <MapButton label="+" a11yLabel="Zoom inn" onPress={onZoomIn} />
      <MapButton label="−" a11yLabel="Zoom ut" onPress={onZoomOut} />
      <View style={styles.divider} />
      <MapButton label="⌂" a11yLabel="Nullstill kartvisning" onPress={onResetView} />
      <MapButton
        label={gpsLoading ? '⏳' : '📍'}
        a11yLabel={gpsLoading ? 'Henter posisjon…' : 'Min posisjon'}
        onPress={onGPS}
        disabled={gpsLoading}
      />
      <MapButton label="🏆" a11yLabel="Toppliste – universelt tilgjengelige veier" onPress={onHighscore} />
      <MapButton label="📋" a11yLabel="Vis objekter i kartet" onPress={onOpenFeatureList} />
      <View style={styles.divider} />
      <MapButton label="🔎" a11yLabel="Søk stedsnavn" onPress={onOpenSearch} />
      <MapButton label="⚙" a11yLabel="Innstillinger" onPress={onOpenSettings} accent />
    </View>
  );
}

function MapButton({
  label,
  a11yLabel,
  onPress,
  accent = false,
  disabled = false,
}: {
  label: string;
  a11yLabel: string;
  onPress?: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        accent && styles.buttonAccent,
        pressed && !accent && styles.buttonPressed,
        pressed && accent && styles.buttonAccentPressed,
        disabled && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Text
        style={[styles.buttonText, accent && styles.buttonTextAccent]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: MapColors.buttonBg,
    borderWidth: 1,
    borderColor: MapColors.divider,
    borderRadius: 14,
    overflow: 'hidden',
  },
  button: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonAccent: {
    backgroundColor: MapColors.accent,
  },
  buttonPressed: {
    backgroundColor: MapTheme.inkLight,
  },
  buttonAccentPressed: {
    backgroundColor: MapColors.accentHover,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 22,
    color: MapColors.buttonText,
  },
  buttonTextAccent: {
    color: MapTheme.ink,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: MapColors.divider,
    opacity: 0.6,
  },
});
