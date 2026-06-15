import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { C } from '../../theme';

export default function SectionLabel({ label }) {
  return <Text style={s.label}>{label.toUpperCase()}</Text>;
}

const s = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.2,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});
