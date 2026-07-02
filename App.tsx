import 'react-native-url-polyfill/auto';
import React, { useEffect, Component } from 'react';
import { StatusBar, ScrollView, Text, AppState } from 'react-native';

class ErrorBoundary extends Component<{children: React.ReactNode, name: string}, {error: string|null}> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message + '\n' + e.stack?.slice(0, 500) }; }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#000', padding: 16 }}>
          <Text style={{ color: '#FF453A', fontSize: 13, fontWeight: '700', marginTop: 60 }}>
            Crash in {this.props.name}:{'\n\n'}{this.state.error}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CheckIn from './src/screens/CheckIn';
import Overview from './src/screens/Overview';
import Progress from './src/screens/Progress';
import Research from './src/screens/Research';
import AskClaude from './src/screens/AskClaude';
import Bloodwork from './src/screens/Bloodwork';
import RecoveryArc from './src/screens/RecoveryArc';
import TabBar from './src/components/TabBar';
import { syncPendingCheckins, syncPendingScalpPhoto } from './src/utils/storage';
import { initNotifications } from './src/services/notifications';
import { color } from './src/theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Progress stack (Progress → Labs) ─────────────────────────────────────────

const WrapProgress = (props: any) => <ErrorBoundary name="Progress"><Progress {...props} /></ErrorBoundary>;
const WrapBloodwork = (props: any) => <ErrorBoundary name="Labs"><Bloodwork {...props} /></ErrorBoundary>;
const WrapCheckIn = (props: any) => <ErrorBoundary name="CheckIn"><CheckIn {...props} /></ErrorBoundary>;
const WrapOverview = (props: any) => <ErrorBoundary name="Overview"><Overview {...props} /></ErrorBoundary>;
const WrapResearch = (props: any) => <ErrorBoundary name="Research"><Research {...props} /></ErrorBoundary>;
const WrapClaude = (props: any) => <ErrorBoundary name="AskClaude"><AskClaude {...props} /></ErrorBoundary>;
const WrapRecoveryArc = (props: any) => <ErrorBoundary name="RecoveryArc"><RecoveryArc {...props} /></ErrorBoundary>;

const RECOVERY_ARC_SCREEN = (
  <Stack.Screen
    name="RecoveryArc"
    component={WrapRecoveryArc}
    options={{ animation: 'slide_from_right', gestureEnabled: true }}
  />
);

function ProgressStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProgressMain" component={WrapProgress} />
      <Stack.Screen
        name="Labs"
        component={WrapBloodwork}
        options={{
          animation: 'slide_from_right',
          gestureEnabled: true,
        }}
      />
      {RECOVERY_ARC_SCREEN}
    </Stack.Navigator>
  );
}

// ── Overview stack (Overview → Recovery Arc) ─────────────────────────────────

function OverviewStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OverviewMain" component={WrapOverview} />
      {RECOVERY_ARC_SCREEN}
    </Stack.Navigator>
  );
}

// ── Root tab navigator (5 tabs) ───────────────────────────────────────────────

export default function App() {
  useEffect(() => {
    syncPendingCheckins();
    syncPendingScalpPhoto();
    initNotifications();
    // Re-sync whenever the app returns to the foreground (covers offline → wifi reconnect)
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') { syncPendingCheckins(); syncPendingScalpPhoto(); }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={color.bg} />
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Overview"
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{ headerShown: false }}
        >
          <Tab.Screen name="Check-in" component={WrapCheckIn} />
          <Tab.Screen name="Overview" component={OverviewStack} />
          <Tab.Screen name="Progress" component={ProgressStack} />
          <Tab.Screen name="Research" component={WrapResearch} />
          <Tab.Screen name="Claude"   component={WrapClaude} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
