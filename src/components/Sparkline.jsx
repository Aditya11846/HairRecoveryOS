import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { color } from '../theme/tokens';

export default function Sparkline({ data = [], strokeColor, width = 80, height = 32 }) {
  const d = useMemo(() => {
    if (data.length < 2) return '';
    const minV = Math.min(...data);
    const maxV = Math.max(...data);
    const range = maxV - minV || 1;
    const pad = 3;
    const W = width - pad * 2;
    const H = height - pad * 2;
    const toX = (i) => pad + (i / (data.length - 1)) * W;
    const toY = (v) => pad + H - ((v - minV) / range) * H;
    const pts = data.map((v, i) => [toX(i), toY(v)]);
    const parts = [`M ${pts[0][0]} ${pts[0][1]}`];
    for (let i = 1; i < pts.length; i++) {
      const cpx1 = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * 0.4;
      const cpx2 = pts[i][0] - (pts[i][0] - pts[i - 1][0]) * 0.4;
      parts.push(`C ${cpx1} ${pts[i - 1][1]} ${cpx2} ${pts[i][1]} ${pts[i][0]} ${pts[i][1]}`);
    }
    return parts.join(' ');
  }, [data, width, height]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {d ? <Path d={d} stroke={strokeColor || color.cool} strokeWidth={2} fill="none" strokeLinecap="round" /> : null}
      </Svg>
    </View>
  );
}
