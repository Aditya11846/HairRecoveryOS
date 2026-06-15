import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

function HairOSLogo({ size = 64 }) {
  const bars = [
    { x: 0,  h: 20, color: '#1a4d3a' },
    { x: 18, h: 32, color: '#26a641' },
    { x: 36, h: 44, color: '#39d353' },
    { x: 54, h: 56, color: '#56e878' },
  ];
  const barW = 12;
  const totalH = 60;

  return (
    <Svg width={size} height={size} viewBox="0 0 76 60">
      {bars.map((bar, i) => (
        <Rect
          key={i}
          x={bar.x}
          y={totalH - bar.h}
          width={barW}
          height={bar.h}
          rx={barW / 2}
          fill={bar.color}
        />
      ))}
    </Svg>
  );
}

export default function SplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(exitOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: exitOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <HairOSLogo size={72} />
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center', marginTop: 20 }}>
          <Text style={s.appName}>HairOS</Text>
          <Text style={s.tagline}>Recovery starts with consistency</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  appName: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.8, marginBottom: 6 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500', letterSpacing: 0.2 },
});
