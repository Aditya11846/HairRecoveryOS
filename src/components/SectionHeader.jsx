import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, type, space } from '../theme/tokens';

export default function SectionHeader({ label, count, style }) {
  return (
    <View style={[s.row, style]}>
      <Text style={s.label}>{label}</Text>
      {count != null && <Text style={s.count}>{count}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: space.xl },
  label: { ...type.eyebrow },
  count: { ...type.eyebrow, color: color.warmA, letterSpacing: 1.3 },
});
