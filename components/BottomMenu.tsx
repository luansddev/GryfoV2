import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated } from 'react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { Feather, AntDesign, Ionicons } from '@expo/vector-icons'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVigias } from '../src/context/VigiasContext';
import { LinearGradient } from 'expo-linear-gradient';
import { getBottomMenuBottom } from '../src/constants/Layout';

const tabs = [
  { name: 'home', icon: 'map', size: 20, family: 'Feather' },
  { name: 'analise', icon: 'fund', family: 'AntDesign' },
  { name: 'notificacoes', icon: 'bell', size: 23, family: 'Feather' },
  { name: 'conta', icon: 'user', family: 'Feather' },
];

const TAB_WIDTH = 48;
const TAB_GAP = 16;
const TRANSITION_DURATION = 200; // Sincronizado com a transição de 200ms das telas

interface BottomMenuProps {
  state?: any;
  navigation?: any;
  descriptors?: any;
  insets?: any;
}

function getActiveTabIndex(
  segments: string[],
  pathname: string,
  state?: any
): number {
  // 1. Prioridade máxima: primeiro segmento da rota ativa no Expo Router
  const firstSeg = segments?.[0];
  if (firstSeg) {
    if (firstSeg === 'biblioteca') return 0;
    const segIndex = tabs.findIndex((t) => t.name === firstSeg);
    if (segIndex >= 0) return segIndex;
  }

  // 2. Pathname da rota ativa (limpando query params e barras)
  const cleanPath = (pathname || '')
    .split('?')[0]
    .replace(/^\//, '')
    .replace(/\/$/, '');
  if (cleanPath === 'biblioteca') return 0;
  const pathIndex = tabs.findIndex((t) => t.name === cleanPath);
  if (pathIndex >= 0) return pathIndex;

  // 3. Fallback: rota ativa no state do React Navigation
  if (state?.routes && typeof state.index === 'number') {
    const routeName = state.routes[state.index]?.name;
    if (routeName === 'biblioteca') return 0;
    const stateIndex = tabs.findIndex((tab) => tab.name === routeName);
    if (stateIndex >= 0) return stateIndex;
  }

  return 0;
}

export default function BottomMenu({ state, navigation }: BottomMenuProps) {
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useVigias();

  const routeIndex = getActiveTabIndex(segments as string[], pathname, state);
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);

  // Sincroniza a seleção otimista com o índice oficial da rota quando a navegação termina
  useEffect(() => {
    if (optimisticIndex !== null && optimisticIndex === routeIndex) {
      setOptimisticIndex(null);
    }
  }, [routeIndex, optimisticIndex]);

  const activeIndex = optimisticIndex ?? routeIndex;

  // Opacidade animada para cada aba com o mesmo timing da tela (200ms)
  const animOpacities = useRef(
    tabs.map((_, i) => new Animated.Value(i === activeIndex ? 1 : 0))
  ).current;

  useEffect(() => {
    tabs.forEach((_, i) => {
      Animated.timing(animOpacities[i], {
        toValue: i === activeIndex ? 1 : 0,
        duration: TRANSITION_DURATION,
        useNativeDriver: true,
      }).start();
    });
  }, [activeIndex]);

  const handleTabPress = (tabName: string, index: number) => {
    // Inicia a transição do marcador imediatamente no toque para sincronizar 1:1 com a tela
    setOptimisticIndex(index);

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
        <View style={styles.tabsRow}>
          {tabs.map((tab, i) => {
            const IconComponent =
              tab.family === 'AntDesign'
                ? AntDesign
                : tab.family === 'Ionicons'
                ? Ionicons
                : Feather;

            return (
              <TouchableOpacity
                key={tab.name}
                onPress={() => handleTabPress(tab.name, i)}
                activeOpacity={1}
                style={styles.tabItem}
              >
                {/* Camada 1: Ícone inativo escuro */}
                <View style={styles.iconCenter}>
                  <IconComponent
                    name={tab.icon as any}
                    size={tab.size || 22}
                    color="#000"
                  />
                </View>

                {/* Camada 2: Cápsula degradê + Ícone branco sincronizados com a transição da tela */}
                <Animated.View
                  style={[
                    styles.activeOverlay,
                    { opacity: animOpacities[i] },
                  ]}
                  pointerEvents="none"
                >
                  <View style={styles.capsuleShadow}>
                    <LinearGradient
                      colors={['#000000', '#0a0d2e', '#1c1f75', '#3331ff']}
                      locations={[0, 0.35, 0.7, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  <IconComponent
                    name={tab.icon as any}
                    size={tab.size || 22}
                    color="#fff"
                  />
                </Animated.View>

                {/* Badge de notificações */}
                {tab.name === 'notificacoes' && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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
  tabItem: {
    position: 'relative',
    width: TAB_WIDTH,
    height: TAB_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconCenter: {
    width: TAB_WIDTH,
    height: TAB_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: TAB_WIDTH,
    height: TAB_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  capsuleShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
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