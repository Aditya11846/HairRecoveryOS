import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { C } from '../../theme';

export default function SectionLabel({ label }) {
  return <Text style={s.label}>{label.toUpperCase()}</Text>;
}

const s = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: C.sub,
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});
