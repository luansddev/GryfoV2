import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { normalizarCidade } from '../../context/Normalizer'; 
import * as Location from 'expo-location';
import { useSearchLocation } from '../../context/SearchLocationContext';
import { Dimensions } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView } from 'react-native';

export default function Dados() {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [dadosCidade, setDadosCidade] = useState<any>(null); 
  const [nomeCidade, setNomeCidade] = useState<string | null>(null);

  const { location: searchedLocation } = useSearchLocation();
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc);

      // Geocodifica o nome da cidade
      const geo = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const cidadeOriginal = geo[0]?.city || geo[0]?.subregion || '';
      const cidadeNormalizada = normalizarCidade(cidadeOriginal);
      setNomeCidade(cidadeNormalizada);

      // Busca os dados do JSON remoto
      const res = await fetch('https://gryfocorp.web.app/ssp-abril-2025.json');
      const json = await res.json();

      // Salva os dados da cidade específica
      setDadosCidade(json[cidadeNormalizada] || null);

      // Move o mapa
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
        <Text>Carregando mapa e dados...</Text>
      </View>
    );
  }
  // Lógica de análise dos dados da cidade
let totalCrimes = 0;
let topCrimes: { nome: string; quantidade: number }[] = [];

if (dadosCidade) {
  const lista = Object.entries(dadosCidade).map(([nome, dados]: any) => ({
    nome,
    quantidade: dados.quantidade,
  }));

  totalCrimes = lista.reduce((acc, cur) => acc + cur.quantidade, 0);

  topCrimes = lista
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 3); // pega os 3 maiores
}


  return (
    
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton
        initialRegion={{
          latitude: userLocation?.coords.latitude || -23.55,
          longitude: userLocation?.coords.longitude || -46.63,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {searchedLocation && (
          <Marker coordinate={searchedLocation} />
        )}
      </MapView>
<ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
<LinearGradient
  colors={['#000000ff', '#0f0cb8ff']} // azul escuro para mais claro
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={{
    borderRadius: 12,
    margin: 16,
  }}
>
  <View style={{ padding: 16 }}>
  <View>
    <Text style={{ color: 'white', fontSize: 24, marginBottom: 16, fontFamily: "texgyR" }}>
      Visão geral
    </Text>

    <View style={{
      borderRadius: 8,
      borderWidth: 2,
      borderColor: "#fff",
      padding: 10,
      alignSelf: 'flex-start',
      marginBottom: 16
    }}>
      <Text style={{ fontFamily: "Avant", fontSize: 16, color: "#fff" }}>
        Total de crimes registrados: <Text style={{ color: "#FF4500" }}>{totalCrimes}</Text>
      </Text>
    </View>

    <Text style={{ color: 'white', fontFamily: "texgyB", fontSize: 18, marginBottom: 10 }}>
      Maiores registros:
    </Text>

    <View style={{ marginBottom: 16 }}>
      {topCrimes.map((crime, index) => (
        <Text key={crime.nome} style={{ color: 'white', fontFamily: "texgyB", fontSize: 16 }}>
          {index + 1}º <Text style={{ fontWeight: "bold" }}>{crime.nome}:</Text> {crime.quantidade}
        </Text>
      ))}
    </View>
  </View>

  <PieChart
    data={[
      {
        name: 'Total de crimes',
        population: totalCrimes,
        color: '#eeeeee',
        legendFontColor: '#fff',
        legendFontSize: 12,
      },
      ...(topCrimes.map((crime, index) => ({
        name: crime.nome,
        population: crime.quantidade,
        color: ['#999999', '#666666', '#333333'][index],
        legendFontColor: '#fff',
        legendFontSize: 12,
      })))
    ]}
    width={Dimensions.get('window').width - 80}
    height={170}
    chartConfig={{
      backgroundGradientFrom: '#001e4d',
      backgroundGradientTo: '#001e4d',
      color: () => `#fff`,
      labelColor: () => '#fff',
    }}
    accessor="population"
    backgroundColor="transparent"
    paddingLeft="0"
    absolute
  />
</View>

</LinearGradient>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

map: {
  width: '100%',
  height: '30%',
}
});
