import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, radius, space, type } from '../theme/tokens';

const TONE_COLOR = {
  cool:    color.cool,
  warm:    color.warmA,
  red:     color.red,
  green:   color.green,
  default: color.txt,
};

export default function StatTile({ label, value, sub, tone = 'default', style }) {
  const valueColor = TONE_COLOR[tone] || color.txt;
  return (
    <View style={[s.tile, style]}>
      <Text style={s.label}>{label}</Text>
      <Text style={[s.value, { color: valueColor }]}>{value}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: color.card,
    borderRadius: radius.stat,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    padding: space.lg,
    minHeight: 92,
  },
  label: { ...type.eyebrow, marginBottom: 6 },
  value: { ...type.statValue },
  sub:   { fontSize: 10, color: color.dim, marginTop: 4, fontFamily: 'System' },
});
