import { Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import BottomMenu from '../../components/BottomMenu';
import { View, StyleSheet } from 'react-native';
import { SearchLocationProvider } from '../context/SearchLocationContext';
import { VigiaCreationProvider, useVigiaCreation } from '../context/VigiaCreationContext';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { SharedMapProvider } from '../context/SharedMapContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const pathname = usePathname(); // Captura a rota atual
  const router = useRouter();
  const segments = useSegments();
  const [user, setUser] = useState<any>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user === undefined) return; // Aguardando carregamento do auth
    
    // Verifica se está em uma tela de autenticação
    const isAuthScreen = segments[0] === 'cadastro' || segments[0] === 'login' || (segments.length as number) === 0;

    if (user && isAuthScreen) {
      // Se estiver logado e na tela inicial/login/cadastro, redireciona para a home
      router.replace('/home');
    } else if (user === null && !isAuthScreen) {
      // Se não estiver logado e tentar acessar uma tela protegida, redireciona para a tela inicial
      router.replace('/');
    }
  }, [user, segments]);

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
    <VigiaCreationProvider>
    <SearchLocationProvider>
    <SharedMapProvider>
      <View style={styles.container}>
      <View style={styles.content}>
        <Tabs tabBar={() => shouldShowMenu ? <BottomMenuWrapper /> : null} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="login" />
          <Tabs.Screen name="cadastro" />
          <Tabs.Screen name="home" />
          <Tabs.Screen name="notificacoes" />
          <Tabs.Screen name="conta" />
          <Tabs.Screen name="configuracoes" />
          <Tabs.Screen name="biblioteca" />
        </Tabs>
      </View>
    </View>
    </SharedMapProvider>
    </SearchLocationProvider>
    </VigiaCreationProvider>
    
  );
}

// Wrapper que esconde o BottomMenu durante criação de vigia
function BottomMenuWrapper() {
  const { isCreatingVigia } = useVigiaCreation();
  if (isCreatingVigia) return null;
  return <BottomMenu />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
