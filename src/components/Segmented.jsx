import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { color, radius, type } from '../theme/tokens';

export default function Segmented({ options, selected, onSelect, style }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.row, style]}
    >
      {options.map((opt) => {
        const isActive = opt === selected;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            activeOpacity={0.75}
          >
            <View style={[s.pill, isActive && s.pillActive]}>
              <Text style={[s.label, isActive && s.labelActive]}>{opt}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingHorizontal: 2 },
  pill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: color.card2 },
  pillActive:  { backgroundColor: color.warmA },
  label:       { ...type.eyebrow, color: color.dim },
  labelActive: { color: '#1A1000' },
});
