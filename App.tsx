import 'react-native-url-polyfill/auto';
import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, StyleSheet, Animated, View, Text, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Polyline, Circle, Line, Defs, LinearGradient, Stop, G } from 'react-native-svg';

import CheckIn from './src/screens/CheckIn';
import Overview from './src/screens/Overview';
import Progress from './src/screens/Progress';
import Research from './src/screens/Research';
import Explore from './src/screens/Explore';
import AskClaude from './src/screens/AskClaude';
import { syncPendingCheckins } from './src/utils/storage';

const Tab = createBottomTabNavigator();

// ─── TAB ICONS ────────────────────────────────────────────────────────────────

function CheckInIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={4} stroke={color} strokeWidth={1.8} />
      <Path d="M8.5 12l2.5 2.5 4.5-5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function OverviewIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} />
      <Rect x={13} y={3} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} opacity={0.6} />
      <Rect x={3} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} opacity={0.6} />
      <Rect x={13} y={13} width={8} height={8} rx={2} stroke={color} strokeWidth={1.8} opacity={0.3} />
    </Svg>
  );
}

function ProgressIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="3 17 7 10 11 14 15 6 21 10" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ResearchIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={1.8} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function ExploreIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.8} />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ClaudeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── HAIROS LOGO (stocks-inspired) ────────────────────────────────────────────

function HairOSLogo({ size = 80 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Background: dark left panel, slightly lighter right */}
      <Rect x={0} y={0} width={100} height={100} rx={22} fill="#1C1C1E" />
      <Rect x={50} y={0} width={50} height={100} rx={0} fill="#242426" />
      <Rect x={50} y={0} width={50} height={100} rx={22} fill="#242426" />
      {/* Fix right-side corners with a clipping overlay */}
      <Rect x={50} y={0} width={6} height={100} fill="#242426" />

      {/* Chart line — white, zigzag across full width */}
      <Path
        d="M8 62 L22 62 L30 44 L38 70 L46 32 L54 55 L62 42 L70 55 L78 48 L92 48"
        stroke="white"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Cyan vertical accent line (the "cursor" line from Stocks app) */}
      <Line x1={62} y1={10} x2={62} y2={90} stroke="#00C7FF" strokeWidth={2.5} />

      {/* Cyan dot at intersection */}
      <Circle cx={62} cy={42} r={5} fill="#00C7FF" />

      {/* Green ascending bars — HairOS identity mark, bottom right */}
      <Rect x={68} y={76} width={4} height={10} rx={2} fill="#1a4d3a" />
      <Rect x={74} y={71} width={4} height={15} rx={2} fill="#26a641" />
      <Rect x={80} y={66} width={4} height={20} rx={2} fill="#39d353" />
      <Rect x={86} y={60} width={4} height={26} rx={2} fill="#56e878" />
    </Svg>
  );
}

// ─── SPLASH SCREEN ────────────────────────────────────────────────────────────

function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      ]),
      Animated.delay(150),
      Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(850),
      Animated.timing(exitOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[splash.container, { opacity: exitOpacity }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <HairOSLogo size={96} />
        <Animated.View style={[{ opacity: textOpacity, alignItems: 'center', marginTop: 20 }]}>
          <Text style={splash.appName}>HairOS</Text>
          <Text style={splash.tagline}>Recovery starts with consistency</Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const splash = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000000',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    marginBottom: 5,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.38)',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});

// ─── CUSTOM TAB BAR ───────────────────────────────────────────────────────────

const TAB_CONFIG = [
  { name: 'Check-in', Icon: CheckInIcon, label: 'Log' },
  { name: 'Overview', Icon: OverviewIcon, label: 'Overview' },
  { name: 'Progress', Icon: ProgressIcon, label: 'Progress' },
  { name: 'Research', Icon: ResearchIcon, label: 'Research' },
  { name: 'Explore', Icon: ExploreIcon, label: 'Explore' },
  { name: 'Claude', Icon: ClaudeIcon, label: 'Claude' },
];

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tb.container, { paddingBottom: insets.bottom || 16 }]}>
      <View style={tb.glass} />
      <View style={tb.topBorder} />
      <View style={tb.row}>
        {TAB_CONFIG.map((tab, index) => {
          const isFocused = state.index === index;
          const { Icon } = tab;
          const color = isFocused ? '#3B82F6' : 'rgba(142,142,147,0.65)';

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes[index].key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <View key={tab.name} style={tb.item}>
              <View style={[tb.iconWrap, isFocused && tb.iconWrapActive]}>
                <Pressable
                  onPress={onPress}
                  style={tb.pressable}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon color={color} />
                  <Text style={[tb.label, { color }]}>{tab.label}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  glass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,10,0.91)',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  row: {
    flexDirection: 'row',
    paddingTop: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  pressable: {
    alignItems: 'center',
    gap: 3,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
});

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    syncPendingCheckins();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      {!splashDone && <SplashScreen onFinish={() => setSplashDone(true)} />}
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Overview"
          tabBar={(props) => <CustomTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
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
