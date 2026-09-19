import { useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopMenu from '../../components/TopMenu';
import Dados from './tabs/dados';
import Relatos from './tabs/relatos';
import Locais from './tabs/locais';
import { useFonts } from 'expo-font';

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
  const [routes] = useState([
    { key: 'dados', title: 'Dados' },
    { key: 'relatos', title: 'Relatos' },
    { key: 'locais', title: 'Locais' },
  ]);

  const renderScene = SceneMap({
    dados: Dados,
    relatos: Relatos,
    locais: Locais,
  });

  const renderTabBar = (props: any) => (
    <TabBar
      {...props}
      renderLabel={({ route, color }) => (
        <Text
          style={{
            fontSize: 24,
            fontFamily: 'texgyR',
            color: color,
          }}
        >
          {route.title}
        </Text>
      )}
      indicatorStyle={{
        backgroundColor: 'black',
        height: 5,
        borderRadius: 50,
      }}
      style={{ backgroundColor: '#f5f5f5' }}
      activeColor="black"
      inactiveColor="#999"
      pressColor="#f5f5f5"
    />
  );

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Spacer />
      <TopMenu renderTabBar={() => null} />
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
        renderTabBar={renderTabBar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
});
