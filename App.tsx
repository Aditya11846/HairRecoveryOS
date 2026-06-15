import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import SplashScreen from './src/screens/SplashScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Polyline, Circle } from 'react-native-svg';

import CheckIn from './src/screens/CheckIn';
import Overview from './src/screens/Overview';
import Progress from './src/screens/Progress';
import Research from './src/screens/Research';
import Explore from './src/screens/Explore';
import AskClaude from './src/screens/AskClaude';
import { syncPendingCheckins } from './src/utils/storage';

const Tab = createBottomTabNavigator();

function CheckInIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={3} stroke={color} strokeWidth={2} />
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function OverviewIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x={3} y={3} width={7} height={7} rx={1.5} fill={color} />
      <Rect x={14} y={3} width={7} height={7} rx={1.5} fill={color} opacity={0.65} />
      <Rect x={3} y={14} width={7} height={7} rx={1.5} fill={color} opacity={0.65} />
      <Rect x={14} y={14} width={7} height={7} rx={1.5} fill={color} opacity={0.35} />
    </Svg>
  );
}

function ProgressIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ResearchIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 11h6M11 8v6" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function ExploreIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ClaudeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

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
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: 'rgba(0,0,0,0.92)',
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(255,255,255,0.10)',
              height: 56,
              paddingBottom: 8,
              paddingTop: 6,
            },
            tabBarActiveTintColor: '#3B82F6',
            tabBarInactiveTintColor: '#8E8E93',
            tabBarLabelStyle: {
              fontSize: 9,
              fontWeight: '600',
              letterSpacing: -0.3,
              marginBottom: 2,
            },
            tabBarItemStyle: {
              paddingHorizontal: 2,
            },
            lazy: false,
          }}
        >
          <Tab.Screen
            name="Check-in"
            component={CheckIn}
            options={{ tabBarIcon: ({ color }) => <CheckInIcon color={color} /> }}
          />
          <Tab.Screen
            name="Overview"
            component={Overview}
            options={{ tabBarIcon: ({ color }) => <OverviewIcon color={color} /> }}
          />
          <Tab.Screen
            name="Progress"
            component={Progress}
            options={{ tabBarIcon: ({ color }) => <ProgressIcon color={color} /> }}
          />
          <Tab.Screen
            name="Research"
            component={Research}
            options={{ tabBarIcon: ({ color }) => <ResearchIcon color={color} /> }}
          />
          <Tab.Screen
            name="Explore"
            component={Explore}
            options={{ tabBarIcon: ({ color }) => <ExploreIcon color={color} /> }}
          />
          <Tab.Screen
            name="Claude"
            component={AskClaude}
            options={{ tabBarIcon: ({ color }) => <ClaudeIcon color={color} /> }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
