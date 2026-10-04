import React, { useCallback } from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface TabTransitionViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function TabTransitionView({ children, style }: TabTransitionViewProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useFocusEffect(
    useCallback(() => {
      // Inicia em estado sutilmente transparente e deslocado
      opacity.value = 0;
      translateY.value = 8;

      // Transição suave de surgimento
      opacity.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });

      return () => {
        // Ao sair do foco da aba, reseta para estar pronto no próximo retorno
        opacity.value = 0;
        translateY.value = 8;
      };
    }, [])
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.default, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  default: {
    flex: 1,
  },
});
