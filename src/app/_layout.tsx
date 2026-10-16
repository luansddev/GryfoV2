import '../utils/fabricEventPolyfill';
import { Tabs, usePathname, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import BottomMenu from '../../components/BottomMenu';
import { View, StyleSheet } from 'react-native';
import { SearchLocationProvider } from '../context/SearchLocationContext';
import { VigiaCreationProvider, useVigiaCreation } from '../context/VigiaCreationContext';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { SharedMapProvider } from '../context/SharedMapContext';
import { VigiasProvider, useVigias } from '../context/VigiasContext';
import { addNotificationTapListener } from '../services/notifications/localNotifications';

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

  // Verifica se está em uma tela de autenticação
  const isAuthScreen = segments[0] === 'cadastro' || segments[0] === 'login' || (segments.length as number) === 0;
  const authReady = user !== undefined;
  // Indica se a rota atual não corresponde ao estado de autenticação (redirect pendente)
  const needsRedirect = authReady && ((!!user && isAuthScreen) || (user === null && !isAuthScreen));

  useEffect(() => {
    if (!authReady) return; // Aguardando carregamento do auth

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
    // Só esconde a splash quando as fontes carregaram, o Firebase restaurou a sessão
    // e o usuário já está na rota correta (evita "piscar" a tela inicial antes da home)
    if (fontsLoaded && authReady && !needsRedirect) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error, authReady, needsRedirect]);

  // Fallback: garante que a splash não fique presa caso o auth demore demais
  useEffect(() => {
    const timeout = setTimeout(() => SplashScreen.hideAsync(), 5000);
    return () => clearTimeout(timeout);
  }, []);

  const renderTabBar = useCallback(() => <BottomMenuWrapper />, []);

  // Obs.: não retornamos null enquanto as fontes carregam. O navegador precisa estar
  // montado desde o início para o expo-router processar o link inicial; a splash
  // nativa continua cobrindo a tela até fontes + auth estarem prontos.

  return (
    <VigiaCreationProvider>
    <VigiasProvider>
    <SearchLocationProvider>
    <SharedMapProvider>
      <VigiaNotificationTapHandler />
      <View style={styles.container}>
      <View style={styles.content}>
        <Tabs tabBar={renderTabBar} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="login" />
          <Tabs.Screen name="cadastro" />
          <Tabs.Screen name="home" />
          <Tabs.Screen name="analise" />
          <Tabs.Screen name="notificacoes" />
          <Tabs.Screen name="conta" />
          <Tabs.Screen name="biblioteca" />
        </Tabs>
      </View>
    </View>
    </SharedMapProvider>
    </SearchLocationProvider>
    </VigiasProvider>
    </VigiaCreationProvider>
    
  );
}

// Wrapper que esconde o BottomMenu durante criação de vigia ou em telas sem menu
function BottomMenuWrapper() {
  const pathname = usePathname();
  const { isCreatingVigia } = useVigiaCreation();
  const hideMenuRoutes = ['/', '/cadastro', '/login'];

  if (hideMenuRoutes.includes(pathname) || isCreatingVigia) {
    return null;
  }
  return <BottomMenu />;
}

// Ao tocar numa notificação de vigia no sistema, leva o usuário ao relato no mapa
function VigiaNotificationTapHandler() {
  const router = useRouter();
  const { markAsRead } = useVigias();

  useEffect(() => {
    return addNotificationTapListener((data) => {
      if (data.notificationId) markAsRead(data.notificationId);

      if (typeof data.latitude === 'number' && typeof data.longitude === 'number' && data.latitude !== 0 && data.longitude !== 0) {
        router.push({
          pathname: '/home',
          params: { focusLat: data.latitude, focusLng: data.longitude, switchTab: 'relatos', openRelatoId: data.relatoId },
        });
      } else {
        router.push('/notificacoes');
      }
    });
  }, [router, markAsRead]);

  return null;
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
