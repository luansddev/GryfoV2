import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSearchLocation } from '../../context/SearchLocationContext';

export default function Dados() {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000" />
        <Text>Carregando mapa...</Text>
      </View>
    );
  }

  const region: Region = {
    latitude: searchedLocation?.latitude || userLocation?.coords.latitude || -23.55,
    longitude: searchedLocation?.longitude || userLocation?.coords.longitude || -46.63,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ width: '100%', height: '36%' }}
        region={region}
        showsUserLocation
        showsMyLocationButton
      >
        {searchedLocation && (
          <Marker coordinate={searchedLocation} />
        )}
      </MapView>
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
});
