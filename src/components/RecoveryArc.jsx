import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import { color, type } from '../theme/tokens';

const W = 320;
const H = 90;
const PAD_X = 12;
const PAD_Y = 10;

function toPath(points) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  const parts = [`M ${first[0]} ${first[1]}`];
  for (let i = 0; i < rest.length; i++) {
    const prev = i === 0 ? first : rest[i - 1];
    const curr = rest[i];
    const cpx1 = prev[0] + (curr[0] - prev[0]) * 0.4;
    const cpx2 = curr[0] - (curr[0] - prev[0]) * 0.4;
    parts.push(`C ${cpx1} ${prev[1]} ${cpx2} ${curr[1]} ${curr[0]} ${curr[1]}`);
  }
  return parts.join(' ');
}

export default function RecoveryArc({ data = [], peakIndex, lapseIndex, projectionFrom, xLabels = [] }) {
  const { points, projPoints, minV, maxV } = useMemo(() => {
    if (!data.length) return { points: [], projPoints: [], minV: 0, maxV: 100 };
    const vals = data.map(d => d.value);
    const minV = Math.max(0, Math.min(...vals) - 5);
    const maxV = Math.min(100, Math.max(...vals) + 10);
    const plotW = W - PAD_X * 2;
    const plotH = H - PAD_Y * 2;
    const toX = (i) => PAD_X + (i / (data.length - 1 || 1)) * plotW;
    const toY = (v) => PAD_Y + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;

    const solidData = projectionFrom != null ? data.slice(0, projectionFrom + 1) : data;
    const projData  = projectionFrom != null ? data.slice(projectionFrom) : [];

    const points     = solidData.map((d, i) => [toX(i), toY(d.value)]);
    const projPoints = projData.map((d, i) => [toX(projectionFrom + i), toY(d.value)]);
    return { points, projPoints, minV, maxV };
  }, [data, projectionFrom]);

  if (!data.length) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTxt}>Log monthly photos to populate recovery arc</Text>
      </View>
    );
  }

  const nowIdx = projectionFrom != null ? projectionFrom - 1 : data.length - 1;
  const toX = (i) => PAD_X + (i / (data.length - 1 || 1)) * (W - PAD_X * 2);
  const toY = (v) => PAD_Y + (H - PAD_Y * 2) - ((v - (Math.max(0, Math.min(...data.map(d => d.value)) - 5))) / ((Math.min(100, Math.max(...data.map(d => d.value)) + 10)) - (Math.max(0, Math.min(...data.map(d => d.value)) - 5)) || 1)) * (H - PAD_Y * 2);

  return (
    <View style={s.wrap}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={s.svg}>
        <Defs>
          <LinearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0"   stopColor={color.cool} />
            <Stop offset="0.5" stopColor={color.warmA} />
            <Stop offset="1"   stopColor={color.warmB} />
          </LinearGradient>
        </Defs>

        {/* Solid line */}
        {points.length > 1 && (
          <Path
            d={toPath(points)}
            stroke="url(#arcGrad)"
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
          />
        )}

        {/* Dashed projection */}
        {projPoints.length > 1 && (
          <Path
            d={toPath(projPoints)}
            stroke={color.warmA}
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="4 4"
            opacity={0.5}
          />
        )}

        {/* Peak marker */}
        {peakIndex != null && peakIndex < data.length && (
          <>
            <Circle cx={toX(peakIndex)} cy={toY(data[peakIndex].value)} r={5} fill={color.warmA} />
            <Circle cx={toX(peakIndex)} cy={toY(data[peakIndex].value)} r={9} fill={color.warmA} opacity={0.2} />
          </>
        )}

        {/* Lapse marker */}
        {lapseIndex != null && lapseIndex < data.length && (
          <>
            <Circle cx={toX(lapseIndex)} cy={toY(data[lapseIndex].value)} r={5} fill={color.red} />
            <Circle cx={toX(lapseIndex)} cy={toY(data[lapseIndex].value)} r={9} fill={color.red} opacity={0.2} />
          </>
        )}

        {/* Now marker */}
        {nowIdx >= 0 && nowIdx < data.length && (
          <>
            <Line
              x1={toX(nowIdx)} y1={PAD_Y}
              x2={toX(nowIdx)} y2={H - PAD_Y}
              stroke={color.faint} strokeWidth={1} strokeDasharray="3 3"
            />
            <Circle cx={toX(nowIdx)} cy={toY(data[nowIdx].value)} r={5} fill={color.txt} />
          </>
        )}
      </Svg>

      {/* X-axis labels */}
      {xLabels.length > 0 && (
        <View style={s.xAxis}>
          {xLabels.map((lbl, i) => (
            <Text key={i} style={[s.xLabel, i === xLabels.length - 1 && { textAlign: 'right' }]}>
              {lbl}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { width: '100%' },
  svg:      { alignSelf: 'center' },
  xAxis:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 12 },
  xLabel:   { ...type.eyebrow, fontSize: 8, color: color.faint, flex: 1, textAlign: 'left' },
  empty:    { height: 90, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { ...type.eyebrow, color: color.faint, textAlign: 'center' },
});
