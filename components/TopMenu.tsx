import React, { useEffect, useState, useMemo } from 'react';
import { View, TextInput, StyleSheet, Text, Platform, Keyboard, TouchableOpacity, LayoutAnimation, Alert, FlatList, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as Location from 'expo-location';
import { useSearchLocation } from '../src/context/SearchLocationContext';
import { normalizarCidade } from '../src/context/Normalizer';
import { useCityDirectory, CityOption } from '../src/hooks/useCityDirectory';
import { resolveSspKey, prettifySspKey } from '../src/services/analytics/CityDirectory';

export default function TopMenu({ renderTabBar }: { renderTabBar?: () => React.ReactNode }) {
  const [locationName, setLocationName] = useState('Carregando...');
  const [searchText, setSearchText] = useState('');
  const { location, setLocation, searchMode, setSearchMode, userCity, setUserCity, searchedCity, setSearchedCity } = useSearchLocation();
  const { cities, ready, search } = useCityDirectory();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadUserLocation();
  }, []);

  const nameFor = (key: string | null) => {
    if (!key) return null;
    const resolved = resolveSspKey(key, cities.map(c => c.key));
    return cities.find(c => c.key === resolved)?.displayName ?? prettifySspKey(key);
  };

  useEffect(() => {
    if (searchedCity) {
      const name = nameFor(searchedCity);
      if (name) setSearchText(name);
    }
  }, [searchedCity, cities]);

  useEffect(() => {
    if (!searchMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setSearchText('');
      setShowDropdown(false);
    }
  }, [searchMode]);

  const loadUserLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLocationName('Permissão negada');
      return;
    }

    const location = await Location.getCurrentPositionAsync({});

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${location.coords.latitude}&lon=${location.coords.longitude}&format=json&accept-language=pt-BR`,
        { headers: { 'User-Agent': 'Gardio/1.0' } }
      );
      const geoJson = await geoRes.json();
      const nomeEncontrado = geoJson?.address?.city || geoJson?.address?.town || geoJson?.address?.municipality || geoJson?.address?.state || 'Localização desconhecida';
      setLocationName(nomeEncontrado);
      setUserCity(normalizarCidade(nomeEncontrado));
    } catch (error) {
      console.error('Erro ao buscar nome da cidade:', error);
      setLocationName('Cidade não encontrada');
    }

    setLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
  };

  const results = useMemo(() => {
    const q = searchText.trim();
    if (!q) return [];
    return search(q, 5);
  }, [searchText, search]);

  const handleSelectCity = async (city: CityOption) => {
    setSearchText(city.displayName);
    setShowDropdown(false);
    Keyboard.dismiss();
    setSearchedCity(city.key);
    setSearchMode(true);

    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city.displayName)}, São Paulo, Brasil&format=json&limit=1`,
        { headers: { 'User-Agent': 'Gardio/1.0' } }
      );
      const geoJson = await geoRes.json();

      if (geoJson && geoJson.length > 0) {
        setLocation({
          latitude: parseFloat(geoJson[0].lat),
          longitude: parseFloat(geoJson[0].lon),
        });
      } else {
        Alert.alert('Erro', 'Não foi possível encontrar as coordenadas para esta cidade.');
      }
    } catch (error) {
      console.error('Erro ao buscar localização:', error);
    }
  };

  const handleSearch = async () => {
    const textToSearch = searchText.trim();
    if (!textToSearch) return;

    if (results.length > 0) {
      await handleSelectCity(results[0]);
      return;
    }

    const resolved = resolveSspKey(textToSearch, cities.map(c => c.key));
    const matchedCity = cities.find(c => c.key === resolved);
    if (matchedCity) {
      await handleSelectCity(matchedCity);
      return;
    }

    Alert.alert('Cidade não encontrada', 'Por favor, pesquise apenas por cidades do estado de São Paulo.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.searchContainer}>
          <View style={styles.switchContainer}>
            <TouchableOpacity
              style={[styles.switchButton, !searchMode && styles.switchButtonActive]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSearchMode(false);
                setSearchedCity(null);
                setSearchText('');
                setShowDropdown(false);
              }}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="location-crosshairs" size={14} color={!searchMode ? "#fff" : "#999"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.switchButton, searchMode && styles.switchButtonActive]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSearchMode(true);
                if (searchedCity && !searchText.trim()) {
                  setSearchText(nameFor(searchedCity) || searchedCity);
                }
              }}
              activeOpacity={0.8}
            >
              <FontAwesome name="search" size={14} color={searchMode ? "#fff" : "#999"} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputArea}>
            {!searchMode ? (
              <Text style={styles.locationStaticText} numberOfLines={1}>{locationName}</Text>
            ) : (
              <>
                <TextInput
                  placeholder="Pesquisar região..."
                  style={styles.searchInput}
                  placeholderTextColor="#999"
                  value={searchText}
                  onChangeText={(text) => {
                    setSearchText(text);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoFocus={false}
                />
                {!ready && searchText.length > 0 && (
                  <ActivityIndicator size="small" color="#999" style={{ marginRight: 6 }} />
                )}
                {searchText.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => {
                      setSearchText('');
                      setShowDropdown(false);
                    }} 
                    style={styles.clearButton}
                  >
                    <FontAwesome name="times-circle" size={16} color="#999" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </View>

      {searchMode && showDropdown && searchText.trim().length > 0 && (
        <View style={styles.dropdownContainer}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => handleSelectCity(item)}
              >
                <FontAwesome name="map-marker" size={14} color="#666" style={{ marginRight: 8 }} />
                <Text style={styles.dropdownItemText}>{item.displayName}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {renderTabBar && renderTabBar()}
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e4e4e4ff',
    borderRadius: 25,
    paddingLeft: 9,
    paddingRight: 6,
    height: 50,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#d0d0d0',
    borderRadius: 20,
    padding: 3,
    marginRight: 10,
  },
  switchButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchButtonActive: {
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  locationStaticText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#333',
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#000',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: -8,
    marginBottom: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#333',
  },
});

