import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
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

  return (
    <Stack
      screenOptions={{
        headerShown: false, // Isso esconde o cabeçalho para TODAS as telas padrão
      }}
    >
      {/* **ADICIONE ESTAS LINHAS AQUI:** */}
      <Stack.Screen name="index" />       {/* Para src/app/index.tsx */}
      <Stack.Screen name="cadastro" />    {/* Para src/app/cadastro.tsx */}
      <Stack.Screen name="login" />       {/* Para src/app/login.tsx */}
      <Stack.Screen name="home" />
      {/* Se você tiver outras telas na raiz de 'src/app', adicione-as aqui também. */}
      
      {/* Exemplo se você tivesse uma pasta para abas: */}
      {/* <Stack.Screen name="(tabs)" options={{ headerShown: false }} /> */}

    </Stack>
  );
}