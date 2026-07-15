import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapColors } from '@/constants/map-theme';

export interface StatusBarProps {
  zoom: number;
  layerCount: number;
}

export function StatusBar({ zoom, layerCount }: StatusBarProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      <Text style={styles.text}>
        Zoom: {zoom} · Lag: {layerCount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: MapColors.statusBg,
    borderWidth: 1,
    borderColor: MapColors.divider,
    borderRadius: 32,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  text: {
    color: MapColors.statusText,
    fontSize: 11,
    fontWeight: '400',
  },
});