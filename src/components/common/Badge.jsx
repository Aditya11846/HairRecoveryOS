import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Badge({ label, color }) {
  return (
    <View style={[s.badge, { backgroundColor: color + '22' }]}>
      <Text style={[s.text, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});
