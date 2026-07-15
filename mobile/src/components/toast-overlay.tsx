import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { MapColors, MapTheme } from '@/constants/map-theme';

let globalShowToast: (message: string, type?: 'info' | 'error') => void = () => {};

export function showToast(message: string, type: 'error' | 'info' = 'error') {
  globalShowToast(message, type);
}

export function ToastOverlay() {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'error' | 'info'>('info');
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    globalShowToast = (msg: string, t?: 'error' | 'info') => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setMessage(msg);
      setType(t ?? 'info');

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 20,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(() => setMessage(''));
      }, 4000);
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [opacity, translateY]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        type === 'error' && styles.errorBorder,
        { opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.text, type === 'error' && styles.errorText]}>
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: MapColors.surface,
    borderWidth: 1,
    borderColor: MapColors.divider,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    zIndex: 9999,
  },
  errorBorder: {
    borderColor: MapTheme.redWarn,
  },
  text: {
    fontSize: 14,
    color: MapColors.bodyText,
    textAlign: 'center',
  },
  errorText: {
    color: '#e8a0a0',
  },
});