import React, { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet, Text, Platform, Keyboard, TouchableOpacity, LayoutAnimation, Alert, FlatList } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import * as Location from 'expo-location';
import { useSearchLocation } from '../src/context/SearchLocationContext';
import { normalizarCidade } from '../src/context/Normalizer';

export default function TopMenu({ renderTabBar }: { renderTabBar?: () => React.ReactNode }) {
  const [locationName, setLocationName] = useState('Carregando...');
  const [searchText, setSearchText] = useState('');
  const { location, setLocation, searchMode, setSearchMode, userCity, setUserCity, searchedCity, setSearchedCity } = useSearchLocation();
  const [validCities, setValidCities] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    loadUserLocation();
    fetchValidCities();
  }, []);

  const fetchValidCities = async () => {
    try {
      const res = await fetch('https://gryfocorp.web.app/ssp-2-2026.json');
      const json = await res.json();
      const cities = Object.keys(json).filter(key => key !== 'nome_da_cidade' && key !== 'timestamp');
      setValidCities(cities);
    } catch (error) {
      console.error('Erro ao buscar lista de cidades:', error);
    }
  };

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
        { headers: { 'User-Agent': 'Gryfo/1.0' } }
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

  const formatCity = (city: string) => {
    return city.replace(/\bS\./, 'SÃO ').toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleSearch = async (cityToSearch?: string) => {
    const textToSearch = cityToSearch || searchText.trim();
    if (!textToSearch) return;

    const normalizedCity = cityToSearch ? cityToSearch : normalizarCidade(textToSearch);
    if (validCities.length > 0 && !validCities.includes(normalizedCity)) {
      Alert.alert('Cidade não encontrada', 'Por favor, pesquise apenas por cidades do estado de São Paulo.');
      return;
    }

    try {
      const formatted = formatCity(normalizedCity);
      setSearchText(formatted);
      setShowDropdown(false);
      Keyboard.dismiss();

      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formatted)}, São Paulo, Brasil&format=json&limit=1`,
        { headers: { 'User-Agent': 'Gryfo/1.0' } }
      );
      const geoJson = await geoRes.json();

      if (geoJson && geoJson.length > 0) {
        setLocation({
          latitude: parseFloat(geoJson[0].lat),
          longitude: parseFloat(geoJson[0].lon),
        });
        setSearchedCity(normalizedCity);
      } else {
        Alert.alert('Erro', 'Não foi possível encontrar as coordenadas para esta cidade.');
      }
    } catch (error) {
      console.error('Erro ao buscar localização:', error);
    }
  };

  const goToUserLocation = async () => {
    await loadUserLocation();
    setSearchText('');
    Keyboard.dismiss(); // Opcional: fecha o teclado
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
                  setSearchText(formatCity(searchedCity));
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
                  onSubmitEditing={() => handleSearch()}
                  returnKeyType="search"
                  autoFocus={true}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearButton}>
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
            data={validCities.filter(c => c.includes(normalizarCidade(searchText.trim()))).slice(0, 5)}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.dropdownItem}
                onPress={() => handleSearch(item)}
              >
                <FontAwesome name="map-marker" size={14} color="#666" style={{ marginRight: 8 }} />
                <Text style={styles.dropdownItemText}>{formatCity(item)}</Text>
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
    backgroundColor: '#f5f5f5',
    paddingTop: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
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
    paddingHorizontal: 6,
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

