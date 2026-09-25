import { useState, useEffect, useRef, useCallback } from 'react';
import { Dimensions, StyleSheet, Text, View, TouchableOpacity, LayoutAnimation, Platform, PanResponder, Animated as RNAnimated, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TopMenu from '../../components/TopMenu';
import Dados from './tabs/dados';
import Relatos from './tabs/relatos';
import Locais from './tabs/locais';
import { useFonts } from 'expo-font';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useVigiaCreation } from '../context/VigiaCreationContext';
import { useSharedMap } from '../context/SharedMapContext';
import { useLocalSearchParams } from 'expo-router';
import SharedMapView from '../components/SharedMapView';

const SCREEN_WIDTH = Dimensions.get('window').width;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function Spacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: "#F5F5F5" }}></View>
}

export function HomeContent() {
  const [fontsLoaded] = useFonts({
    texgyR: require('../../assets/fontes/texgyreadventor-regular.otf'),
  });

  const [index, setIndex] = useState(0);
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const translateX = useRef(new RNAnimated.Value(-index * SCREEN_WIDTH)).current;

  const [routes] = useState([
    { key: 'dados', title: 'Dados', icon: 'chart-line' },
    { key: 'relatos', title: 'Relatos', icon: 'comment-dots' },
    { key: 'locais', title: 'Vigias', icon: 'eye' },
  ]);

  const { isCreatingVigia } = useVigiaCreation();
  const { setActiveTab, setMapInteractionEnabled, isCreatingRelato } = useSharedMap();

  const animateToTab = useCallback((i: number) => {
    RNAnimated.spring(translateX, {
      toValue: -i * SCREEN_WIDTH,
      useNativeDriver: true,
      friction: 26,
      tension: 170,
    }).start();
  }, [translateX]);

  const handleTabPress = useCallback((i: number) => {
    setIndex(i);
    animateToTab(i);
    
    // Crucial for performance: defer the heavy map state updates
    // until after the swipe animation finishes, avoiding stuttering.
    InteractionManager.runAfterInteractions(() => {
      setActiveTab(i);
      setMapInteractionEnabled(true);
    });
  }, [animateToTab, setActiveTab, setMapInteractionEnabled]);

  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.switchTab === 'relatos') {
      handleTabPress(1);
    }
  }, [params.switchTab, handleTabPress]);

  const stateRef = useRef({ isCreatingVigia, isCreatingRelato, handleTabPress });
  useEffect(() => {
    stateRef.current = { isCreatingVigia, isCreatingRelato, handleTabPress };
  }, [isCreatingVigia, isCreatingRelato, handleTabPress]);

  // Full-screen PanResponder using CAPTURE to intercept strictly horizontal
  // swipes before the MapView (a child) claims them. Non-horizontal gestures
  // are left alone so the map can pan/zoom freely.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        if (stateRef.current.isCreatingVigia || stateRef.current.isCreatingRelato) return false;
        const absDx = Math.abs(gestureState.dx);
        const absDy = Math.abs(gestureState.dy);
        return absDx > 10 && absDx > absDy * 2;
      },
      onPanResponderMove: (_, gestureState) => {
        // Follow finger 1:1 for a fluid feel, clamped to valid range
        const baseOffset = -indexRef.current * SCREEN_WIDTH;
        const minOffset = -SCREEN_WIDTH * (routes.length - 1);
        const raw = baseOffset + gestureState.dx;
        translateX.setValue(Math.max(minOffset, Math.min(0, raw)));
      },
      onPanResponderRelease: (_, gestureState) => {
        let newIndex = indexRef.current;
        // Use velocity OR distance to decide
        if (gestureState.vx > 0.4 || gestureState.dx > SCREEN_WIDTH * 0.2) {
          newIndex = Math.max(0, newIndex - 1);
        } else if (gestureState.vx < -0.4 || gestureState.dx < -SCREEN_WIDTH * 0.2) {
          newIndex = Math.min(routes.length - 1, newIndex + 1);
        }
        
        if (newIndex === indexRef.current) {
          // Snap back if threshold not met
          animateToTab(indexRef.current);
        } else {
          stateRef.current.handleTabPress(newIndex);
        }
      },
      onPanResponderTerminate: () => {
        animateToTab(indexRef.current);
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* ================= SHARED MAP ================= */}
      <SharedMapView />

      {/* ================= SWIPEABLE TAB VIEWS ================= */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" {...panResponder.panHandlers}>
        <RNAnimated.View
          style={[
            StyleSheet.absoluteFill,
            { flexDirection: 'row', width: SCREEN_WIDTH * 3, transform: [{ translateX }] }
          ]}
          pointerEvents="box-none"
        >
          <View style={{ width: SCREEN_WIDTH }} pointerEvents="box-none"><Dados /></View>
          <View style={{ width: SCREEN_WIDTH }} pointerEvents="box-none"><Relatos /></View>
          <View style={{ width: SCREEN_WIDTH }} pointerEvents="box-none"><Locais /></View>
        </RNAnimated.View>
      </View>

      {/* ================= TOP OVERLAY ================= */}
      {!(isCreatingVigia || isCreatingRelato) && (
        <View style={styles.overlayContainer} pointerEvents="box-none">
          <View style={styles.topSection}>
            <Spacer />
            <TopMenu />
          </View>
          <View style={styles.capsulesContainer} pointerEvents="box-none">
            {routes.map((route, i) => {
               const isActive = index === i;
               return (
                   <AnimatedTouchableOpacity
                   key={route.key}
                   style={[styles.capsule, isActive && styles.capsuleActive]}
                   onPress={() => handleTabPress(i)}
                   activeOpacity={0.8}
                   layout={LinearTransition.duration(250)}
                 >
                   {isActive ? (
                     <Animated.Text entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.capsuleText, styles.capsuleTextActive]}>
                       {route.title}
                     </Animated.Text>
                   ) : (
                     <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
                       <FontAwesome6 name={route.icon} size={16} color="#666" />
                     </Animated.View>
                   )}
                 </AnimatedTouchableOpacity>
               );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

export default function Home() {
  return <HomeContent />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topSection: {
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  capsulesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 10,
  },
  capsule: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 45,
  },
  capsuleActive: {
    backgroundColor: '#fff',
  },
  capsuleText: {
    fontFamily: 'texgyR',
    fontSize: 14,
    color: '#666',
  },
  capsuleTextActive: {
    color: '#000',
    fontFamily: 'texgyB',
  },
});
