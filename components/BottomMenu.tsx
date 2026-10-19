import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather, AntDesign, Ionicons } from '@expo/vector-icons'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVigias } from '../src/context/VigiasContext';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { getBottomMenuBottom } from '../src/constants/Layout';

const tabs = [
  { name: 'home', icon: 'map', size: 20, family: 'Feather' },
  { name: 'analise', icon: 'fund', family: 'AntDesign' },
  { name: 'notificacoes', icon: 'zap', family: 'Feather' },
  { name: 'conta', icon: 'user', family: 'Feather' },
];

const TAB_WIDTH = 48;
const TAB_GAP = 16;
const TAB_STEP = TAB_WIDTH + TAB_GAP; // 64
const TOTAL_TABS_WIDTH = tabs.length * TAB_WIDTH + (tabs.length - 1) * TAB_GAP; // 240

interface BottomMenuProps {
  state?: any;
  navigation?: any;
  descriptors?: any;
  insets?: any;
}

function getActiveIndex(state: any, pathname: string): number {
  if (state?.routes && typeof state.index === 'number') {
    const routeName = state.routes[state.index]?.name;
    if (routeName === 'biblioteca') return 0;
    const found = tabs.findIndex((tab) => tab.name === routeName);
    if (found >= 0) return found;
  }

  const clean = (pathname || '').split('?')[0].replace(/\/$/, '');
  if (clean === '/biblioteca' || clean === 'biblioteca') return 0;
  const pathIndex = tabs.findIndex((tab) => clean === `/${tab.name}` || clean === tab.name);
  return pathIndex >= 0 ? pathIndex : 0;
}

export default function BottomMenu({ state, navigation }: BottomMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useVigias();

  const activeIndex = getActiveIndex(state, pathname);
  const translateX = useSharedValue(activeIndex * TAB_STEP);
  const prevIndexRef = useRef(activeIndex);

  useEffect(() => {
    if (activeIndex !== prevIndexRef.current) {
      prevIndexRef.current = activeIndex;
      translateX.value = withSpring(activeIndex * TAB_STEP, {
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      });
    }
  }, [activeIndex]);

  const capsuleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const innerIconsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -translateX.value }],
  }));

  const handleTabPress = (tabName: string, index: number) => {
    prevIndexRef.current = index;
    translateX.value = withSpring(index * TAB_STEP, {
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    });

    if (navigation && state?.routes) {
      const currentRouteName = state.routes[state.index]?.name;
      const isFocused = currentRouteName === tabName;
      const route = state.routes.find((r: any) => r.name === tabName);

      const event = navigation.emit({
        type: 'tabPress',
        target: route?.key || tabName,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(tabName);
      }
    } else {
      router.navigate(`/${tabName}` as any);
    }
  };

  return (
    <View style={[styles.floatingWrapper, { bottom: getBottomMenuBottom(insets.bottom) }]}>
      <View style={styles.container}>
        {/* Camada 1: Ícones escuros na base da navbar */}
        <View style={styles.tabsRow} pointerEvents="none">
          {tabs.map((tab) => {
            const IconComponent = tab.family === 'AntDesign' ? AntDesign : (tab.family === 'Ionicons' ? Ionicons : Feather);
            return (
              <View key={tab.name} style={styles.iconWrapper}>
                <IconComponent name={tab.icon as any} size={tab.size || 22} color="#000" />
              </View>
            );
          })}
        </View>

        {/* Camada 2: Cápsula animada com degradê e ícones brancos em máscara invertida */}
        <Animated.View style={[styles.capsuleShadow, capsuleAnimatedStyle]} pointerEvents="none">
          <View style={styles.capsuleClipper}>
            <LinearGradient
              colors={['#000000', '#0a0d2e', '#1c1f75', '#3331ff']}
              locations={[0, 0.35, 0.7, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Animated.View style={[styles.innerIconsRow, innerIconsAnimatedStyle]}>
              {tabs.map((tab) => {
                const IconComponent = tab.family === 'AntDesign' ? AntDesign : (tab.family === 'Ionicons' ? Ionicons : Feather);
                return (
                  <View key={tab.name} style={styles.iconWrapper}>
                    <IconComponent name={tab.icon as any} size={tab.size || 22} color="#fff" />
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </Animated.View>

        {/* Camada 3: Touch targets e badges de notificação */}
        <View style={styles.touchablesRow} pointerEvents="box-none">
          {tabs.map((tab, i) => (
            <TouchableOpacity
              key={tab.name}
              onPress={() => handleTabPress(tab.name, i)}
              activeOpacity={0.8}
              style={styles.iconWrapper}
            >
              {tab.name === 'notificacoes' && unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  container: {
    position: 'relative',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: TAB_GAP,
    alignItems: 'center',
  },
  touchablesRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    gap: TAB_GAP,
    alignItems: 'center',
  },
  capsuleShadow: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: TAB_WIDTH,
    height: TAB_WIDTH,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  capsuleClipper: {
    width: TAB_WIDTH,
    height: TAB_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
  },
  innerIconsRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: TOTAL_TABS_WIDTH,
    height: TAB_WIDTH,
    flexDirection: 'row',
    gap: TAB_GAP,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: TAB_WIDTH,
    height: TAB_WIDTH,
    borderRadius: 16,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});