import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { color, radius, type } from '../theme/tokens';

// intensity 0-4, miss flag
// intensity 0 = no data  (dark neutral)
// intensity 1 = partial  (warm dim)
// intensity 2 = full     (warm mid)
// intensity 3 = streak   (warm full)
// intensity 4 = perfect  (warmA)
// miss = true → red tint (damage)

const CELL_BG = [
  '#1A1A1E',         // 0 — no data
  '#3A2E12',         // 1 — partial
  '#7A5A1E',         // 2 — full
  '#C98A22',         // 3 — streak
  '#FFB020',         // 4 — perfect
];
const MISS_BG  = '#3A1715';
const MISS_DOT = '#FF453A';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Heatmap({ cells = [], onCellPress, weeks = 12 }) {
  // cells is a flat array [week0day0, week0day1, ..., weekNday6]
  // total = weeks × 7 entries
  const CELL = 17;
  const GAP  = 3;

  return (
    <View style={s.wrap}>
      {/* Day labels */}
      <View style={s.dayCol}>
        {DAYS.map((d, i) => (
          <Text key={i} style={[s.dayLabel, i % 2 === 0 && { opacity: 0 }]}>{d}</Text>
        ))}
      </View>
      {/* Weeks */}
      <View style={s.grid}>
        {Array.from({ length: weeks }, (_, wi) => (
          <View key={wi} style={s.col}>
            {Array.from({ length: 7 }, (_, di) => {
              const idx = wi * 7 + di;
              const cell = cells[idx] || { intensity: 0 };
              const bg = cell.miss ? MISS_BG : CELL_BG[cell.intensity ?? 0];
              return (
                <TouchableOpacity
                  key={di}
                  onPress={() => onCellPress?.(cell, wi, di)}
                  activeOpacity={0.7}
                  style={[s.cell, { width: CELL, height: CELL, backgroundColor: bg, margin: GAP / 2 }]}
                >
                  {cell.miss && <View style={s.missDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// Intensity legend
export function HeatmapKey() {
  return (
    <View style={sk.wrap}>
      <Text style={sk.less}>Less</Text>
      {CELL_BG.map((bg, i) => (
        <View key={i} style={[sk.cell, { backgroundColor: bg }]} />
      ))}
      <View style={[sk.cell, { backgroundColor: MISS_BG, borderWidth: 1, borderColor: MISS_DOT }]} />
      <Text style={sk.miss}>Miss</Text>
      <Text style={sk.more}>More</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'flex-start' },
  dayCol:   { marginRight: 4, marginTop: 1 },
  dayLabel: { fontSize: 8, color: color.faint, height: 20, lineHeight: 20, textAlign: 'right' },
  grid:     { flexDirection: 'row', flexWrap: 'nowrap' },
  col:      { flexDirection: 'column' },
  cell:     { borderRadius: 3 },
  missDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: MISS_DOT, alignSelf: 'center', marginTop: 6 },
});

const sk = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  cell:  { width: 11, height: 11, borderRadius: 2 },
  less:  { fontSize: 9, color: color.faint },
  more:  { fontSize: 9, color: color.faint },
  miss:  { fontSize: 9, color: MISS_DOT },
});
