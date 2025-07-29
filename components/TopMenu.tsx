import React, { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, Text, Platform, Keyboard, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as Location from 'expo-location';
import { useSearchLocation } from '../src/context/SearchLocationContext';

export default function TopMenu({ renderTabBar }: { renderTabBar?: () => React.ReactNode }) {
  const [locationName, setLocationName] = useState('Carregando...');
  const [searchText, setSearchText] = useState('');
  const [confirmedSearch, setConfirmedSearch] = useState('');
  const { setLocation } = useSearchLocation();
  

  useEffect(() => {
    loadUserLocation();
  }, []);

  const loadUserLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationName('Permissão negada');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});
    const geocode = await Location.reverseGeocodeAsync(location.coords);

    if (geocode.length > 0) {
      const { city, subregion, region } = geocode[0];
      setLocationName(city || subregion || region || 'Localização desconhecida');
    } else {
      setLocationName('Cidade não encontrada');
    }

    setLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    try {
      setConfirmedSearch(searchText.trim());
      const [result] = await Location.geocodeAsync(searchText);
      if (result) {
        setLocation({
          latitude: result.latitude,
          longitude: result.longitude,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar localização:', error);
    }
  };

  const goToUserLocation = async () => {
    await loadUserLocation();
    setSearchText('');
    setConfirmedSearch('');
    Keyboard.dismiss(); // Opcional: fecha o teclado
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={14} color="#000" style={styles.icon} />
          <TextInput
            placeholder="Pesquisar região"
            style={styles.searchInput}
            placeholderTextColor="#000"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        {/* ⬇️ Faz localização ser clicável */}
        <TouchableOpacity onPress={goToUserLocation} style={styles.locationContainer}>
          <FontAwesome6
            name="location-crosshairs"
            size={18}
            color={confirmedSearch ? 'gray' : 'black'}
            style={styles.locationIcon}
          />
          <Text
            style={[
              styles.locationText,
              { color: confirmedSearch ? 'gray' : 'black' },
            ]}
          >
            {locationName}
          </Text>
        </TouchableOpacity>
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
    width: '60%',
    height: 45
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
function onSearch(arg0: string) {
  throw new Error('Function not implemented.');
}

