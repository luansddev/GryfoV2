import { useState, useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View, TouchableOpacity, LayoutAnimation, Platform, UIManager, Image } from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopMenu from '../../components/TopMenu';
import Dados from './tabs/dados';
import Relatos from './tabs/relatos';
import Locais from './tabs/locais';
import { useFonts } from 'expo-font';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useVigiaCreation } from '../context/VigiaCreationContext';
import { useLocalSearchParams } from 'expo-router';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const initialLayout = { width: Dimensions.get('window').width };

function Spacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: "#F5F5F5" }}></View>
}

export default function Home() {
  const [fontsLoaded] = useFonts({
    texgyR: require('../../assets/fontes/texgyreadventor-regular.otf'),
  });

  const [index, setIndex] = useState(0);
  const params = useLocalSearchParams();

  useEffect(() => {
    if (params.switchTab === 'relatos') {
      setIndex(1);
    }
  }, [params.switchTab]);

  const [routes] = useState([
    { key: 'dados', title: 'Dados', icon: 'chart-line' },
    { key: 'relatos', title: 'Relatos', icon: 'comment-dots' },
    { key: 'locais', title: 'Vigias', icon: 'eye' },
  ]);

  const { isCreatingVigia } = useVigiaCreation();

  const renderScene = SceneMap({
    dados: Dados,
    relatos: Relatos,
    locais: Locais,
  });

  const renderTabBar = () => null;

  if (!fontsLoaded) return null;

  const handleTabPress = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIndex(i);
  };

  return (
    <View style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleTabPress}
        initialLayout={initialLayout}
        renderTabBar={renderTabBar}
        swipeEnabled={!isCreatingVigia}
      />
      {!isCreatingVigia && (
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
