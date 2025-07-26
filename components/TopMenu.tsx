import React, { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, Text, Platform } from 'react-native';
import { FontAwesome, Entypo } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as Location from 'expo-location';

export default function TopMenu({ renderTabBar }: { renderTabBar?: () => React.ReactNode }) {
  const [locationName, setLocationName] = useState('Carregando...');
  
  useEffect(() => {
    (async () => {
      try {
        // Solicita permissão
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationName('Permissão negada');
          return;
        }

        // Pega localização atual
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        // Busca nome da cidade
        const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (geocode.length > 0) {
          const { city, subregion, region } = geocode[0];

          const nomeFormatado = city || subregion || region || 'Localização desconhecida';
          setLocationName(nomeFormatado);
        } else {
          setLocationName('Cidade não encontrada');
        }
      } catch (error) {
        console.error('Erro ao obter localização:', error);
        setLocationName('Erro de localização');
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={14} color="#000" style={styles.icon} />
          <TextInput
            placeholder="Pesquisar região"
            style={styles.searchInput}
            placeholderTextColor="#000"
          />
        </View>
        <View style={styles.locationContainer}>
          <FontAwesome6 name="location-crosshairs" size={18} color="black" style={styles.locationIcon}/>
          <Text style={styles.locationText}>{locationName}</Text>
        </View>
      </View>

      {renderTabBar && renderTabBar()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e4e4e4ff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '60%',
  },
  icon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#000',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: '5%',
  },
  locationIcon: {
    marginRight: 6,
  },
  locationText: {
    fontSize: 15,
    fontFamily: 'texgyB',
    color: '#000',
    marginBottom: 3
  },
});
