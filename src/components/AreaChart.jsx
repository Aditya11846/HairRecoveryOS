import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { color } from '../theme/tokens';

const PAD_X = 8;
const PAD_Y = 8;

function buildPaths(data, W, H, minV, maxV) {
  if (data.length < 2) return { line: '', area: '' };
  const plotW = W - PAD_X * 2;
  const plotH = H - PAD_Y * 2;
  const range = maxV - minV || 1;
  const toX = (i) => PAD_X + (i / (data.length - 1)) * plotW;
  const toY = (v) => PAD_Y + plotH - ((v - minV) / range) * plotH;

  const pts = data.map((v, i) => [toX(i), toY(v)]);
  const parts = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 1; i < pts.length; i++) {
    const cpx1 = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * 0.4;
    const cpx2 = pts[i][0] - (pts[i][0] - pts[i - 1][0]) * 0.4;
    parts.push(`C ${cpx1} ${pts[i - 1][1]} ${cpx2} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]}`);
  }
  const line = parts.join(' ');
  const lastX = pts[pts.length - 1][0];
  const bottom = H - PAD_Y;
  const area = `${line} L ${lastX} ${bottom} L ${PAD_X} ${bottom} Z`;
  return { line, area };
}

export default function AreaChart({ data = [], strokeColor, height = 100, width }) {
  const W = width || 300;
  const H = height;
  const sc = strokeColor || color.red;

  const { line, area, minV, maxV } = useMemo(() => {
    if (!data.length) return { line: '', area: '', minV: 0, maxV: 10 };
    const minV = Math.max(0, Math.min(...data) - 1);
    const maxV = Math.max(...data) + 1;
    const { line, area } = buildPaths(data, W, H, minV, maxV);
    return { line, area, minV, maxV };
  }, [data, W, H]);

  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={sc} stopOpacity={0.25} />
            <Stop offset="1"   stopColor={sc} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {area  && <Path d={area}  fill="url(#areaFill)" />}
        {line  && <Path d={line}  stroke={sc} strokeWidth={2} fill="none" strokeLinecap="round" />}
      </Svg>
    </View>
  );
}
