import { Slot, usePathname } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import BottomMenu from '../../components/BottomMenu';
import { View, StyleSheet } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname(); // Captura a rota atual

  const [fontsLoaded, error] = useFonts({
    'Avant': require('../../assets/fontes/AvantGarde-Bold.otf'),
    'GlacialB': require('../../assets/fontes/GlacialIndifference-Bold.otf'),
    'GlaicalI': require('../../assets/fontes/GlacialIndifference-Italic.otf'),
    'GlacialR': require('../../assets/fontes/GlacialIndifference-Regular.otf'),
    'texgyR': require('../../assets/fontes/texgyreadventor-regular.otf'),
    'texgyB': require('../../assets/fontes/texgyreadventor-bold.otf'),
    'texgyI': require('../../assets/fontes/texgyreadventor-italic.otf'),
  });

  useEffect(() => {
    if (error) throw error;
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) {
    return null;
  }

  const hideMenuRoutes = ['/', '/cadastro', '/login'];
  const shouldShowMenu = !hideMenuRoutes.includes(pathname);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>
      {shouldShowMenu && <BottomMenu />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
