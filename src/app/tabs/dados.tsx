import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, TouchableOpacity, ScrollView, Dimensions, LayoutAnimation, Platform, UIManager, Image } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { normalizarCidade } from '../../context/Normalizer';
import * as Location from 'expo-location';
import { useSearchLocation } from '../../context/SearchLocationContext';
import { PieChart, BarChart, ProgressChart, } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Dados() {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [dadosCidade, setDadosCidade] = useState<any>(null);
  const [nomeCidade, setNomeCidade] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(true);

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

      const geo = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      const cidadeOriginal = geo[0]?.city || geo[0]?.subregion || '';
      const cidadeNormalizada = normalizarCidade(cidadeOriginal);
      setNomeCidade(cidadeNormalizada);

      const res = await fetch('https://gryfocorp.web.app/ssp-abril-2025.json');
      const json = await res.json();
      setDadosCidade(json[cidadeNormalizada] || null);

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

  // ================= LÓGICA DE ANÁLISE =================
  let totalCrimes = 0;
  let topCrimes: { nome: string; quantidade: number }[] = [];

  let crimesContraVida = {
    doloso: 0,
    culposo: 0,
    tentativa: 0,
    latrocinio: 0,
  };

  if (dadosCidade) {
    const lista = Object.entries(dadosCidade).map(([nome, dados]: any) => ({
      nome,
      quantidade: dados.quantidade,
    }));

    totalCrimes = lista.reduce((acc, cur) => acc + cur.quantidade, 0);

    topCrimes = lista
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 3);

    // captura crimes contra a vida
    crimesContraVida.doloso = dadosCidade["HOMICÍDIO DOLOSO"]?.quantidade || 0;
    crimesContraVida.culposo = dadosCidade["HOMICÍDIO CULPOSO OUTROS"]?.quantidade || 0;
    crimesContraVida.tentativa = dadosCidade["TENTATIVA DE HOMICÍDIO"]?.quantidade || 0;
    crimesContraVida.latrocinio = dadosCidade["LATROCÍNIO"]?.quantidade || 0;
  }

  const somaContraVida =
    crimesContraVida.doloso +
    crimesContraVida.culposo +
    crimesContraVida.tentativa +
    crimesContraVida.latrocinio;

  // ================= TOGGLE MAPA =================
  const toggleMapSize = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMapExpanded((prev) => !prev);
  };

  return (
    <View style={styles.container}>
      {/* Área do mapa */}
      <View style={{ height: mapExpanded ? '100%' : '30%' }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
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

        {/* Botão fixo sobre o mapa */}
        <TouchableOpacity style={styles.toggleButton} onPress={toggleMapSize}>
          <Text style={styles.toggleText}>
            {mapExpanded ? 'Ver dados' : 'Expandir mapa'}
          </Text>
          <Image
            source={
              mapExpanded
                ? require('../../../assets/icons/dados.png')
                : require('../../../assets/icons/expand.png')
            }
            style={styles.toggleIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Conteúdo só aparece se o mapa não está expandido */}
      {!mapExpanded && (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* CARD VISÃO GERAL */}
          <LinearGradient
            colors={['#000000ff', '#0f0cb8ff']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={{ padding: 16 }}>
              <Text style={styles.title}>Visão geral</Text>

              <View style={styles.totalBox}>
                <Text style={{ fontFamily: "Avant", fontSize: 16, color: "#fff" }}>
                  Total de crimes registrados: <Text style={{ color: "#FF4500" }}>{totalCrimes}</Text>
                </Text>
              </View>

              <Text style={styles.subtitle}>Maiores registros:</Text>

              <View style={{ marginBottom: 16 }}>
                {topCrimes.map((crime, index) => (
                  <Text key={crime.nome} style={styles.topCrime}>
                    {index + 1}º <Text style={{ fontWeight: "bold" }}>{crime.nome}:</Text> {crime.quantidade}
                  </Text>
                ))}
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

          {/* CARD CRIMES CONTRA A VIDA */}
          <LinearGradient
            colors={['#000', '#000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={{ padding: 16 }}>
              <Text style={styles.title}>Crimes contra a vida</Text>

              <View style={{ marginBottom: 16 }}>
                <Text style={styles.topCrime}><Text style={{ fontWeight: "bold" }}>Homicídio Doloso:</Text> {crimesContraVida.doloso}</Text>
                <Text style={styles.topCrime}><Text style={{ fontWeight: "bold" }}>Homicídio Culposo:</Text> {crimesContraVida.culposo}</Text>
                <Text style={styles.topCrime}><Text style={{ fontWeight: "bold" }}>Tentativa de Homicídio:</Text> {crimesContraVida.tentativa}</Text>
                <Text style={styles.topCrime}><Text style={{ fontWeight: "bold" }}>Latrocínio:</Text> {crimesContraVida.latrocinio}</Text>
              </View>

              {/* Gráfico Pizza */}
              <View style={{ marginBottom: 16, alignItems: "center" }}>
                <PieChart
                  data={[
                    { name: "Homicídio Doloso", population: crimesContraVida.doloso, color: "#af0202ff", legendFontColor: "#fff", legendFontSize: 12 },
                    { name: "Tentativa de Homicídio", population: crimesContraVida.tentativa, color: "#e85050ff", legendFontColor: "#fff", legendFontSize: 12 },
                    { name: "Homicídio Culposo", population: crimesContraVida.culposo, color: "#6d0404ff", legendFontColor: "#fff", legendFontSize: 12 },
                    { name: "Latrocínio", population: crimesContraVida.latrocinio, color: "#ff0000ff", legendFontColor: "#fff", legendFontSize: 12 },
                  ]}
                  width={Dimensions.get("window").width - 80}
                  height={170}
                  chartConfig={{
                    backgroundGradientFrom: "#001e4d",
                    backgroundGradientTo: "#001e4d",
                    color: () => "#fff",
                    labelColor: () => "#fff",
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="0"
                  absolute
                />
              </View>

              {/* Gráfico Barras */}
              <BarChart
                data={{
                  labels: ["Essa natureza", "Total de Crimes"],
                  datasets: [
                    { data: [somaContraVida, totalCrimes] }
                  ]
                }}
                width={Dimensions.get("window").width - 70}
                height={180}
                chartConfig={{
                  backgroundGradientFrom: "#ffffffff",
                  backgroundGradientTo: "#ffffffff",
                  color: () => "#000000ff",
                  labelColor: () => "#000000ff",
                  barPercentage: 0.6,
                }}
                fromZero
                showValuesOnTopOfBars
                style={{
                  borderRadius: 10,
                }}
              />
            </View>
          </LinearGradient>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  toggleButton: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'flex-end',
    marginEnd: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0401c2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
  },

  toggleIcon: {
    width: 18,
    height: 18,
    marginLeft: 8,
  },

  toggleText: {
    fontSize: 16,
    fontFamily: 'GlacialR',
    color: '#ffffffff',
  },

  card: { borderRadius: 12, margin: 16 },
  title: { color: 'white', fontSize: 24, marginBottom: 16, fontFamily: "texgyR" },
  subtitle: { color: 'white', fontFamily: "texgyB", fontSize: 18, marginBottom: 10 },
  topCrime: { color: 'white', fontFamily: "texgyB", fontSize: 16 },
  totalBox: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
    padding: 10,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
});
