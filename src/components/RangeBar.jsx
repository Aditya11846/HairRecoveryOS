import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { color, radius, type } from '../theme/tokens';

// direction: 'above' = higher is better (Ferritin, Vit D, Testosterone)
//            'below' = lower is better (DHT, TSH)
export default function RangeBar({ value, min, max, threshold, direction = 'above', unit }) {
  const clamped = Math.min(Math.max(value ?? min, min), max);
  const pct = (clamped - min) / (max - min);
  const threshPct = (threshold - min) / (max - min);

  const inRange = direction === 'above' ? value >= threshold : value <= threshold;
  const dotColor = value == null ? color.faint : inRange ? color.green : color.red;
  const goodZoneColor = 'rgba(48,209,88,0.12)';
  const badZoneColor  = 'rgba(255,69,58,0.12)';

  return (
    <View style={s.wrap}>
      <View style={s.track}>
        {/* Good zone */}
        {direction === 'above'
          ? <View style={[s.zone, { left: `${threshPct * 100}%`, right: 0, backgroundColor: goodZoneColor }]} />
          : <View style={[s.zone, { left: 0, right: `${(1 - threshPct) * 100}%`, backgroundColor: goodZoneColor }]} />
        }
        {/* Bad zone */}
        {direction === 'above'
          ? <View style={[s.zone, { left: 0, right: `${(1 - threshPct) * 100}%`, backgroundColor: badZoneColor }]} />
          : <View style={[s.zone, { left: `${threshPct * 100}%`, right: 0, backgroundColor: badZoneColor }]} />
        }
        {/* Threshold line */}
        <View style={[s.threshLine, { left: `${threshPct * 100}%` }]} />
        {/* Value dot */}
        {value != null && (
          <View style={[s.dot, { left: `${pct * 100}%`, backgroundColor: dotColor }]} />
        )}
      </View>
      <View style={s.meta}>
        <Text style={s.metaTxt}>{min}{unit}</Text>
        <Text style={[s.metaTxt, { color: color.faint }]}>target {direction === 'above' ? '≥' : '≤'}{threshold}{unit}</Text>
        <Text style={s.metaTxt}>{max}{unit}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { marginTop: 8 },
  track:      { height: 8, borderRadius: radius.full, backgroundColor: color.card2, overflow: 'visible', position: 'relative' },
  zone:       { position: 'absolute', top: 0, bottom: 0, borderRadius: radius.full },
  threshLine: { position: 'absolute', top: -2, bottom: -2, width: 1.5, backgroundColor: color.faint, marginLeft: -0.75 },
  dot:        { position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7, marginLeft: -7, borderWidth: 2, borderColor: color.card },
  meta:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  metaTxt:    { fontSize: 10, color: color.dim, fontFamily: 'System' },
});
