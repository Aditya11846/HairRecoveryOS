import React from 'react';
import { View, StyleSheet } from 'react-native';
import { color, radius, space } from '../theme/tokens';

export default function Card({ children, flush, style }) {
  return (
    <View style={[s.card, flush && s.flush, style]}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    padding: space.lg,
    marginBottom: space.md,
  },
  flush: { padding: 0 },
});
