import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, type } from '../theme/tokens';
import { LogIcon, Grid, Chart, Dna, Chat } from './Icon';

const TABS = [
  { name: 'Check-in', label: 'Log',      Icon: LogIcon },
  { name: 'Overview', label: 'Overview', Icon: Grid },
  { name: 'Progress', label: 'Progress', Icon: Chart },
  { name: 'Research', label: 'Research', Icon: Dna },
  { name: 'Claude',   label: 'Claude',   Icon: Chat },
];

export default function TabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, 16);

  return (
    <View style={[s.wrapper, { paddingBottom: safeBottom }]}>
      <View style={s.topBorder} pointerEvents="none" />
      <View style={s.row}>
        {TABS.map((tab, i) => {
          const focused = state.index === i;
          const iconColor = focused ? color.warmA : color.faint;
          const labelColor = focused ? color.warmA : color.faint;
          const route = state.routes[i];
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(tab.name);
          };
          return (
            <Pressable
              key={tab.name}
              style={s.item}
              onPress={onPress}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <tab.Icon color={iconColor} size={22} focused={focused} />
              <Text style={[s.label, { color: labelColor }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 1000, elevation: 1000,
    backgroundColor: color.tabBar,
  },
  topBorder: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.line,
  },
  row: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 52,
    gap: 4,
  },
  label: {
    fontSize: 8.5,
    fontFamily: 'System',
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
