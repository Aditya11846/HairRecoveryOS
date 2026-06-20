import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, StyleSheet, Animated, View, Text, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Polyline, Circle, Line } from 'react-native-svg';

import CheckIn from './src/screens/CheckIn';
import Overview from './src/screens/Overview';
import Progress from './src/screens/Progress';
import Research from './src/screens/Research';
import Explore from './src/screens/Explore';
import AskClaude from './src/screens/AskClaude';
import { syncPendingCheckins } from './src/utils/storage';

const Tab = createBottomTabNavigator();

function CheckInIcon({ color, focused }: { color: string; focused?: boolean }) {
  const sw = focused ? 2.4 : 1.8;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={4} stroke={color} strokeWidth={sw} />
      <Path d="M8.5 12l2.5 2.5 4.5-5" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function OverviewIcon({ color, focused }: { color: string; focused?: boolean }) {
  const sw = focused ? 2.4 : 1.8;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={sw} />
      <Rect x={13} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={sw} opacity={0.55} />
      <Rect x={3} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={sw} opacity={0.55} />
      <Rect x={13} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={sw} opacity={0.25} />
    </Svg>
  );
}
function ProgressIcon({ color, focused }: { color: string; focused?: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="3 17 7 9 11 14 15 5 21 9" stroke={color} strokeWidth={focused ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ResearchIcon({ color, focused }: { color: string; focused?: boolean }) {
  const sw = focused ? 2.4 : 1.8;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={sw} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
    </Svg>
  );
}
function ExploreIcon({ color, focused }: { color: string; focused?: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={focused ? 2.4 : 1.8} />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke={color} strokeWidth={focused ? 2.0 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ClaudeIcon({ color, focused }: { color: string; focused?: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" stroke={color} strokeWidth={focused ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Logo: Stocks-inspired green chart, cyan cursor line, no inner decorations
function HairOSLogo({ size = 88 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x={0} y={0} width={100} height={100} rx={22} fill="#1A1A1C" />
      <Rect x={51} y={0} width={49} height={100} fill="#222224" />
      <Rect x={50} y={0} width={2} height={100} fill="#1A1A1C" />
      <Path
        d="M6 65 L18 65 L26 48 L34 72 L44 28 L54 52 L63 38 L72 52 L82 44 L94 44"
        stroke="#39d353"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Line x1={63} y1={14} x2={63} y2={88} stroke="#00C7FF" strokeWidth={2} />
      <Circle cx={63} cy={38} r={5.5} fill="#00C7FF" />
      <Circle cx={63} cy={38} r={9} fill="#00C7FF" opacity={0.18} />
    </Svg>
  );
}

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 100, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(rootOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[sp.root, { opacity: rootOpacity }]}>
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }], alignItems: 'center' }}>
        <HairOSLogo size={100} />
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center', marginTop: 22 }}>
          <Text style={sp.name}>HairOS</Text>
          <Text style={sp.tag}>Recovery starts with consistency</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
const sp = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  },
  name: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 5 },
  tag: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
});

const TABS = [
  { name: 'Check-in', label: 'Log', Icon: CheckInIcon },
  { name: 'Overview', label: 'Overview', Icon: OverviewIcon },
  { name: 'Progress', label: 'Progress', Icon: ProgressIcon },
  { name: 'Research', label: 'Research', Icon: ResearchIcon },
  { name: 'Explore', label: 'Explore', Icon: ExploreIcon },
  { name: 'Claude', label: 'Claude', Icon: ClaudeIcon },
];

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 16);
  return (
    <View style={[tb.wrapper, { paddingBottom: safeBottom }]} pointerEvents="box-none">
      <View style={tb.bg} pointerEvents="none" />
      <View style={tb.border} pointerEvents="none" />
      <View style={tb.row}>
        {TABS.map((tab, i) => {
          const focused = state.index === i;
          const color = focused ? '#3B82F6' : 'rgba(180,180,185,0.85)';
          return (
            <Pressable
              key={tab.name}
              style={tb.item}
              onPress={() => navigation.navigate(tab.name)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <View style={[tb.pill, focused && tb.pillActive]}>
                <tab.Icon color={color} focused={focused} />
              </View>
              <Text style={[tb.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const tb = StyleSheet.create({
  wrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000, elevation: 1000 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0A0A0C' },
  border: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  row: { flexDirection: 'row', paddingTop: 10, paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, minHeight: 50 },
  pill: { width: 42, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  pillActive: { backgroundColor: 'rgba(59,130,246,0.18)' },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: -0.1, textAlign: 'center' },
});

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => { syncPendingCheckins(); }, []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Overview"
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Check-in" component={CheckIn} />
          <Tab.Screen name="Overview" component={Overview} />
          <Tab.Screen name="Progress" component={Progress} />
          <Tab.Screen name="Research" component={Research} />
          <Tab.Screen name="Explore" component={Explore} />
          <Tab.Screen name="Claude" component={AskClaude} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
