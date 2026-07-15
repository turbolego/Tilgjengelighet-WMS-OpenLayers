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
  gpsLoading = false,
}: ActionBarProps) {
  return (
    <View style={styles.container}>
      <MapButton label="+" onPress={onZoomIn} />
      <MapButton label="−" onPress={onZoomOut} />
      <View style={styles.divider} />
      <MapButton label="⌂" onPress={onResetView} />
      <MapButton
        label={gpsLoading ? '⏳' : '📍'}
        onPress={onGPS}
        disabled={gpsLoading}
      />
      <MapButton label="🏆" onPress={onHighscore} />
      <View style={styles.divider} />
      <MapButton label="⚙" onPress={onOpenSettings} accent />
    </View>
  );
}

function MapButton({
  label,
  onPress,
  accent = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
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
      accessibilityLabel={label}
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