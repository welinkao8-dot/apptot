import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getDriverLocationFreshness } from '../utils/driverLocationFreshness';

export default function DriverLocationStatus({ updatedAt, mapRef }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

  const state = getDriverLocationFreshness(updatedAt, now);
  useEffect(() => {
    if (state === 'stale') mapRef?.current?.clearDriverPosition();
  }, [state, updatedAt, mapRef]);
  const message = state === 'fresh'
    ? 'Localização do motorista atualizada'
    : state === 'stale'
      ? 'Localização do motorista desatualizada'
      : 'A aguardar localização do motorista';

  return (
    <View accessibilityLiveRegion="polite" style={styles.pill}>
      <View style={[styles.dot, state === 'fresh' ? styles.fresh : state === 'stale' ? styles.stale : styles.waiting]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', top: 12, left: 16, right: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, elevation: 4, zIndex: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  fresh: { backgroundColor: '#16834a' },
  stale: { backgroundColor: '#c27712' },
  waiting: { backgroundColor: '#64748b' },
  text: { color: '#1b2638', fontSize: 12, fontWeight: '700' },
});
