import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  LayoutAnimation,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSearchLocation } from '../../context/SearchLocationContext';
import { useCityDirectory, CityOption } from '../../hooks/useCityDirectory';
import { resolveSspKey } from '../../services/analytics/CityDirectory';

/**
 * Barra de busca de cidades paulistas para a tela de Análise.
 * Segue o mesmo visual do TopMenu (alternância Localização / Pesquisa) e
 * compartilha o estado via SearchLocationContext, mantendo mapa e abas sincronizados.
 */
export default function CitySearchBar() {
  const { searchMode, setSearchMode, userCity, searchedCity, setSearchedCity, setLocation } = useSearchLocation();
  const { cities, ready, search } = useCityDirectory();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const nameFor = (key: string | null) => {
    if (!key) return null;
    const resolved = resolveSspKey(key, cities.map(c => c.key));
    return cities.find(c => c.key === resolved)?.displayName ?? null;
  };

  // Mantém o texto sincronizado quando a cidade é alterada em outra tela
  useEffect(() => {
    if (searchedCity && !focused) {
      const name = nameFor(searchedCity);
      if (name) setText(name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchedCity, cities]);

  const results = useMemo(() => (focused ? search(text) : []), [focused, text, cities]);
  const showDropdown = searchMode && focused && text.trim().length > 0;

  const handleSelect = async (city: CityOption) => {
    setText(city.displayName);
    setFocused(false);
    Keyboard.dismiss();
    setSearchedCity(city.key);
    setSearchMode(true);

    // Sincroniza o mapa das outras abas com a cidade escolhida
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city.displayName)}, São Paulo, Brasil&format=json&limit=1`,
        { headers: { 'User-Agent': 'Gardio/1.0' } }
      );
      const json = await res.json();
      if (json?.length > 0) {
        setLocation({ latitude: parseFloat(json[0].lat), longitude: parseFloat(json[0].lon) });
      }
    } catch {
      // Falha no geocoding não impede a análise
    }
  };

  const switchToLocation = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchMode(false);
    setSearchedCity(null);
    setFocused(false);
    Keyboard.dismiss();
  };

  const switchToSearch = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSearchMode(true);
    if (searchedCity && !text) setText(nameFor(searchedCity) ?? '');
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const userCityName = nameFor(userCity);

  return (
    <View>
      <View style={styles.searchContainer}>
        <View style={styles.switchContainer}>
          <TouchableOpacity
            style={[styles.switchButton, !searchMode && styles.switchButtonActive]}
            onPress={switchToLocation}
            activeOpacity={0.8}
            accessibilityLabel="Usar minha localização"
          >
            <FontAwesome6 name="location-crosshairs" size={14} color={!searchMode ? '#fff' : '#999'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchButton, searchMode && styles.switchButtonActive]}
            onPress={switchToSearch}
            activeOpacity={0.8}
            accessibilityLabel="Pesquisar cidade"
          >
            <FontAwesome name="search" size={14} color={searchMode ? '#fff' : '#999'} />
          </TouchableOpacity>
        </View>

        <View style={styles.inputArea}>
          {!searchMode ? (
            <TouchableOpacity style={{ flex: 1 }} onPress={switchToSearch} activeOpacity={0.7}>
              <Text style={styles.locationStaticText} numberOfLines={1}>
                {userCityName ?? (userCity ? 'Sua localização' : 'Toque para pesquisar uma cidade')}
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                ref={inputRef}
                placeholder="Pesquisar cidade de SP..."
                style={styles.searchInput}
                placeholderTextColor="#999"
                value={text}
                onChangeText={setText}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 150)}
                onSubmitEditing={() => results[0] && handleSelect(results[0])}
                returnKeyType="search"
                autoCorrect={false}
              />
              {!ready && focused && <ActivityIndicator size="small" color="#999" style={{ marginRight: 6 }} />}
              {text.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setText('');
                    inputRef.current?.focus();
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

      {showDropdown && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.dropdownContainer}>
          {results.length > 0 ? (
            results.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.dropdownItem, idx === results.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.dropdownIcon}>
                  <FontAwesome6 name="city" size={11} color="#475569" />
                </View>
                <Text style={styles.dropdownItemText} numberOfLines={1}>{item.displayName}</Text>
                <Text style={styles.dropdownUf}>SP</Text>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.dropdownEmpty}>
              <Text style={styles.dropdownEmptyText}>
                {ready ? 'Nenhuma cidade paulista encontrada' : 'Carregando cidades...'}
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
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
  inputArea: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  locationStaticText: { fontSize: 14, fontFamily: 'texgyB', color: '#333', marginLeft: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'texgyR', color: '#000', paddingVertical: 0 },
  clearButton: { padding: 4, marginLeft: 4 },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  dropdownItemText: { flex: 1, fontSize: 14, fontFamily: 'texgyR', color: '#333' },
  dropdownUf: { fontSize: 11, fontFamily: 'texgyB', color: '#94a3b8' },
  dropdownEmpty: { padding: 16, alignItems: 'center' },
  dropdownEmptyText: { fontSize: 13, fontFamily: 'texgyR', color: '#94a3b8' },
});
