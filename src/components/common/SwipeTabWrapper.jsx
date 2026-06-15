import React, { useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const TAB_ORDER = ['Check-in', 'Overview', 'Progress', 'Research', 'Explore', 'Claude'];

export default function SwipeTabWrapper({ children, currentTab }) {
  const navigation = useNavigation();
  const startX = useRef(0);
  const startY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > 12;
      },
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.pageX;
        startY.current = e.nativeEvent.pageY;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        const currentIdx = TAB_ORDER.indexOf(currentTab);
        if (dx < -40 && currentIdx < TAB_ORDER.length - 1) {
          navigation.navigate(TAB_ORDER[currentIdx + 1]);
        } else if (dx > 40 && currentIdx > 0) {
          navigation.navigate(TAB_ORDER[currentIdx - 1]);
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}
