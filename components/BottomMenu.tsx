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

function getActiveIndex(pathname: string): number {
  return tabs.findIndex(
    (tab) => pathname === `/${tab.name}` || (tab.name === 'home' && pathname === '/biblioteca')
  );
}

export default function BottomMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useVigias();

  const activeIndex = getActiveIndex(pathname);
  const initialIndex = activeIndex >= 0 ? activeIndex : 0;
  const translateX = useSharedValue(initialIndex * TAB_STEP);
  const isFirstRender = useRef(true);
  const targetIndexRef = useRef(initialIndex);

  useEffect(() => {
    const idx = getActiveIndex(pathname);
    if (idx >= 0) {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        targetIndexRef.current = idx;
        translateX.value = idx * TAB_STEP;
      } else if (targetIndexRef.current !== idx) {
        targetIndexRef.current = idx;
        translateX.value = withSpring(idx * TAB_STEP, {
          damping: 18,
          stiffness: 180,
          mass: 0.8,
        });
      }
    }
  }, [pathname, translateX]);

  const capsuleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const innerIconsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -translateX.value }],
  }));

  const handleTabPress = (tabName: string, index: number) => {
    const currentIndex = getActiveIndex(pathname);
    if (currentIndex === index && targetIndexRef.current === index) return;

    targetIndexRef.current = index;
    translateX.value = withSpring(index * TAB_STEP, {
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    });

    requestAnimationFrame(() => {
      if (pathname !== `/${tabName}`) {
        router.navigate(`/${tabName}` as any);
      }
    });
  };

  return (
    <View style={[styles.floatingWrapper, { bottom: Math.max(insets.bottom + 20, 30) }]}>
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