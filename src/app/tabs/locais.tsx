import { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  LayoutAnimation,
  TextInput,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Modal,
} from 'react-native';

import MapView, { Marker, Circle, PROVIDER_GOOGLE, Region, MapPressEvent } from 'react-native-maps';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, FadeInUp } from 'react-native-reanimated';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useVigiaCreation } from '../../context/VigiaCreationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ================= TYPES ================= */

interface Vigia {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // em metros
  createdAt: number;
  address?: string;
}

const STORAGE_KEY = '@gryfo_vigias';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const RADIUS_MIN = 100;
const RADIUS_MAX = 2000;
const RADIUS_DEFAULT = 500;

/* ================= COMPONENTE PRINCIPAL ================= */

export default function Locais() {
  const { setIsCreatingVigia } = useVigiaCreation();
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);

  // Lista de vigias salvos
  const [vigias, setVigias] = useState<Vigia[]>([]);

  // Estado da UI: 'idle' = mapa normal, 'creating' = modo criação, 'listing' = painel aberto
  const [uiMode, setUiMode] = useState<'idle' | 'creating' | 'listing'>('idle');
  const [vigiaToDelete, setVigiaToDelete] = useState<Vigia | null>(null);

  // Modo criação — sub-estados
  const [creatingStep, setCreatingStep] = useState<'picking' | 'configuring'>('picking');
  const [selectedPoint, setSelectedPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [vigiaName, setVigiaName] = useState('');
  const [vigiaRadius, setVigiaRadius] = useState(RADIUS_DEFAULT);
  const [searchedPoint, setSearchedPoint] = useState<{ latitude: number; longitude: number } | null>(null);

  const RADIUS_OPTIONS = [100, 250, 500, 720, 1000];

  // Pesquisa de endereço no modo picking
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard tracking
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Controle de renderização dos marcadores no Google Maps (Android)
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    if (tracksViewChanges) {
      const timer = setTimeout(() => {
        setTracksViewChanges(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [tracksViewChanges, vigias]);

  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: -23.5505,
    longitude: -46.6333,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  // Animated panel
  const translateY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (uiMode === 'listing') {
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 250 });
    }
  }, [uiMode]);

  const animatedScrollStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  /* ================= CARREGAR LOCALIZAÇÃO E VIGIAS ================= */

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status !== 'granted') {
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        if (!isMounted) return;
        setUserLocation(loc);

        const newRegion = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion);
      } catch (error) {
        console.warn('Erro ao obter localização:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    // Carregar vigias salvos
    loadVigias();

    return () => { isMounted = false; };
  }, []);

  /* ================= PERSISTÊNCIA ================= */

  const loadVigias = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Vigia[] = JSON.parse(stored);
        setVigias(parsed);

        // Se algum vigia não tiver endereço (ex: criado anteriormente), busca em background
        const needsAddr = parsed.filter(v => !v.address);
        if (needsAddr.length > 0) {
          Promise.all(
            parsed.map(async v => {
              if (v.address) return v;
              const addr = await fetchAddress(v.latitude, v.longitude);
              return { ...v, address: addr };
            })
          ).then(updated => {
            setVigias(updated);
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          }).catch(() => { });
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar vigias:', e);
    }
  };

  const saveVigias = async (newVigias: Vigia[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newVigias));
      setVigias(newVigias);
    } catch (e) {
      console.warn('Erro ao salvar vigias:', e);
    }
  };

  /* ================= KEYBOARD TRACKING ================= */

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /* ================= PESQUISA DE ENDEREÇO ================= */

  const handleSearchAddress = (text: string) => {
    setSearchText(text);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (text.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const query = encodeURIComponent(`${text.trim()}, São Paulo, Brasil`);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5&countrycodes=br&accept-language=pt-BR`,
          { headers: { 'User-Agent': 'Gryfo/1.0' } }
        );
        const json = await res.json();
        // Filtra apenas resultados no estado de SP
        const filtered = json.filter((r: any) =>
          r.display_name?.includes('São Paulo') || r.display_name?.includes('SP')
        );
        setSearchResults(filtered.slice(0, 5));
      } catch (e) {
        console.warn('Erro na pesquisa de endereço:', e);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    setSearchText('');
    setSearchResults([]);
    Keyboard.dismiss();

    setSearchedPoint({ latitude: lat, longitude: lon });

    // Anima o mapa para o resultado
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  /* ================= GEOCODING REVERSO ================= */

  const fetchAddress = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const item = results[0];
        const street = item.street || item.name || '';
        const number = item.streetNumber ? `, ${item.streetNumber}` : '';
        const district = item.district || item.subregion ? ` - ${item.district || item.subregion}` : '';
        const city = item.city ? `, ${item.city}` : '';
        const formatted = `${street}${number}${district}${city}`.replace(/^[\s,-]+/, '').trim();
        if (formatted.length > 3) return formatted;
      }
    } catch (e) {
      console.warn('reverseGeocodeAsync error, fallback to nominatim:', e);
    }

    // Fallback Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
        { headers: { 'User-Agent': 'Gryfo/1.0' } }
      );
      const data = await res.json();
      if (data && data.address) {
        const road = data.address.road || data.address.pedestrian || data.address.suburb || '';
        const num = data.address.house_number ? `, ${data.address.house_number}` : '';
        const suburb = data.address.suburb || data.address.neighbourhood ? ` - ${data.address.suburb || data.address.neighbourhood}` : '';
        const city = data.address.city || data.address.town || data.address.municipality || '';
        const formatted = `${road}${num}${suburb}${city ? `, ${city}` : ''}`.replace(/^[\s,-]+/, '').trim();
        if (formatted.length > 3) return formatted;
        if (data.display_name) return data.display_name.split(',').slice(0, 3).join(',');
      }
    } catch (err) {
      console.warn('Nominatim reverse error:', err);
    }

    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  };

  /* ================= HANDLERS ================= */

  const handleStartCreating = () => {
    setUiMode('creating');
    setIsCreatingVigia(true);
    setCreatingStep('picking');
    setSelectedPoint(null);
    setSelectedAddress(null);
    setLoadingAddress(false);
    setSearchedPoint(null);
    setVigiaName('');
    setVigiaRadius(RADIUS_DEFAULT);
    setSearchText('');
    setSearchResults([]);
  };

  const handleCancelCreating = () => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUiMode('idle');
    setIsCreatingVigia(false);
    setCreatingStep('picking');
    setSelectedPoint(null);
    setSelectedAddress(null);
    setLoadingAddress(false);
    setSearchedPoint(null);
    setVigiaName('');
    setVigiaRadius(RADIUS_DEFAULT);
    setSearchText('');
    setSearchResults([]);
  };

  const handleMapPress = async (e: MapPressEvent) => {
    if (uiMode !== 'creating') return;

    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedPoint({ latitude, longitude });
    setSearchedPoint(null); // Clear searched point on selection
    setCreatingStep('configuring');

    // Anima o mapa para centralizar no ponto selecionado
    mapRef.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });

    setLoadingAddress(true);
    setSelectedAddress(null);
    try {
      const addr = await fetchAddress(latitude, longitude);
      setSelectedAddress(addr);
    } catch {
      setSelectedAddress(formatCoords(latitude, longitude));
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleSaveVigia = async () => {
    if (!selectedPoint) return;

    const trimmedName = vigiaName.trim();
    if (!trimmedName) {
      Alert.alert('Nome obrigatório', 'Dê um nome ao seu vigia para identificá-lo.');
      return;
    }

    let finalAddress = selectedAddress;
    if (!finalAddress) {
      finalAddress = await fetchAddress(selectedPoint.latitude, selectedPoint.longitude);
    }

    const newVigia: Vigia = {
      id: `vigia_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: trimmedName,
      latitude: selectedPoint.latitude,
      longitude: selectedPoint.longitude,
      radius: vigiaRadius,
      address: finalAddress,
      createdAt: Date.now(),
    };

    const updated = [...vigias, newVigia];
    await saveVigias(updated);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUiMode('idle');
    setIsCreatingVigia(false);
    setCreatingStep('picking');
    setSelectedPoint(null);
    setSelectedAddress(null);
    setVigiaName('');
    setVigiaRadius(RADIUS_DEFAULT);
  };

  const handleConfirmDelete = async () => {
    if (!vigiaToDelete) return;
    const id = vigiaToDelete.id;
    setVigiaToDelete(null);
    const updated = vigias.filter(v => v.id !== id);
    await saveVigias(updated);
  };

  const handleFocusVigia = (vigia: Vigia) => {
    // Calcula o delta para que o raio caiba na tela
    const radiusInDegrees = (vigia.radius / 111320) * 3;
    mapRef.current?.animateToRegion({
      latitude: vigia.latitude,
      longitude: vigia.longitude,
      latitudeDelta: Math.max(radiusInDegrees, 0.01),
      longitudeDelta: Math.max(radiusInDegrees, 0.01),
    });

    if (uiMode === 'listing') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setUiMode('idle');
    }
  };

  const handleOpenListing = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUiMode('listing');
  };

  const handleCloseListing = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUiMode('idle');
  };



  /* ================= FORMATAÇÃO ================= */

  const formatRadius = (r: number) => {
    if (r >= 1000) return `${(r / 1000).toFixed(1)}km`;
    return `${r}m`;
  };

  const formatCoords = (lat: number, lng: number) => {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, fontFamily: 'texgyR', color: '#555' }}>Carregando mapa...</Text>
      </View>
    );
  }

  /* ================= RENDER ================= */

  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1, width: SCREEN_WIDTH }}
          initialRegion={region}
          showsUserLocation={true}
          showsMyLocationButton={false}
          minZoomLevel={5}
          onPress={uiMode === 'creating' ? handleMapPress : undefined}
          onRegionChangeComplete={(reg) => setRegion(reg)}
        >
          {/* Vigias salvos — Círculos de raio */}
          {vigias.map(vigia => (
            <Circle
              key={`circle-${vigia.id}`}
              center={{ latitude: vigia.latitude, longitude: vigia.longitude }}
              radius={vigia.radius}
              fillColor="rgba(59, 130, 246, 0.12)"
              strokeColor="rgba(59, 130, 246, 0.45)"
              strokeWidth={2}
            />
          ))}

          {/* Vigias salvos — Marcadores */}
          {vigias.map(vigia => (
            <Marker
              key={`marker-${vigia.id}`}
              coordinate={{ latitude: vigia.latitude, longitude: vigia.longitude }}
              title={vigia.name}
              description={`Raio: ${formatRadius(vigia.radius)}`}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={tracksViewChanges}
            >
              <View style={styles.vigiaMarkerWrapper} collapsable={false}>
                <Svg width={36} height={36} viewBox="0 0 36 36">
                  <SvgCircle cx="18" cy="18" r="13" fill="#1d4ed8" stroke="#fff" strokeWidth={2.5} />
                  <Path
                    transform="translate(2, 2)"
                    d="M16 11C12.8 11 10.1 13 9 16c1.1 3 3.8 5 7 5s5.9-2 7-5c-1.1-3-3.8-5-7-5zm0 8.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.5a2 2 0 100 4 2 2 0 000-4z"
                    fill="#fff"
                  />
                </Svg>
              </View>
            </Marker>
          ))}

          {/* Marcador Temporário de Pesquisa (Target) */}
          {uiMode === 'creating' && searchedPoint && (
            <Marker coordinate={searchedPoint} anchor={{ x: 0.5, y: 1 }}>
              <View style={{ alignItems: 'center' }}>
                <View style={styles.targetCallout}>
                  <Text style={styles.targetCalloutText}>Toque aqui para confirmar</Text>
                </View>
                <Svg width={40} height={40} viewBox="0 0 40 40">
                  <SvgCircle cx="20" cy="20" r="18" fill="rgba(255, 255, 255, 0.3)" stroke="#fff" strokeWidth={2} strokeDasharray="4 4" />
                  <SvgCircle cx="20" cy="20" r="4" fill="#fff" />
                  <Path d="M20 2v6M20 38v-6M2 20h6M38 20h-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </View>
            </Marker>
          )}

          {/* Ponto selecionado durante criação — Círculo preview */}
          {uiMode === 'creating' && selectedPoint && (
            <Circle
              center={selectedPoint}
              radius={vigiaRadius}
              fillColor="rgba(59, 130, 246, 0.15)"
              strokeColor="rgba(59, 130, 246, 0.6)"
              strokeWidth={2}
            />
          )}

          {/* Ponto selecionado durante criação — Marcador */}
          {uiMode === 'creating' && selectedPoint && (
            <Marker
              coordinate={selectedPoint}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={true}
            >
              <View style={styles.vigiaMarkerWrapper} collapsable={false}>
                <Svg width={40} height={40} viewBox="0 0 40 40">
                  <SvgCircle cx="20" cy="20" r="15" fill="#2563eb" stroke="#fff" strokeWidth={3} />
                  <Path
                    transform="translate(2, 2)"
                    d="M18 12.5C14.5 12.5 11.6 14.7 10.4 18c1.2 3.3 4.1 5.5 7.6 5.5s6.4-2.2 7.6-5.5c-1.2-3.3-4.1-5.5-7.6-5.5zm0 9a3.8 3.8 0 110-7.6 3.8 3.8 0 010 7.6zm0-6a2.2 2.2 0 100 4.4 2.2 2.2 0 000-4.4z"
                    fill="#fff"
                  />
                </Svg>
              </View>
            </Marker>
          )}
        </MapView>

        {/* ================= OVERLAY: MODO CRIAÇÃO — INSTRUÇÃO + CANCELAR ================= */}
        {uiMode === 'creating' && (
          <>
            {/* Botão de Cancelar criação */}
            <TouchableOpacity
              style={[styles.cancelBtn, { top: insets.top + 16 }]}
              onPress={handleCancelCreating}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="xmark" size={13} color="#dc2626" style={{ marginRight: 6 }} />
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            {/* Bottom Overlay: Barra de Pesquisa + Instrução */}
            {creatingStep === 'picking' && (
              <KeyboardAvoidingView
                style={[
                  styles.bottomOverlayContainer,
                  { bottom: Math.max(Math.round(SCREEN_HEIGHT * 0.15), keyboardHeight + 20) },
                ]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                pointerEvents="box-none"
              >
                {searchResults.length > 0 && (
                  <View style={styles.searchResultsContainer}>
                    {searchResults.map((item, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.searchResultItem}
                        onPress={() => handleSelectSearchResult(item)}
                      >
                        <FontAwesome6 name="location-dot" size={14} color="#64748b" style={{ marginRight: 10 }} />
                        <Text style={styles.searchResultText} numberOfLines={2}>
                          {item.display_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.pickingCard}>
                  <View style={styles.searchBarInner}>
                    <FontAwesome6 name="magnifying-glass" size={15} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Pesquisar endereço em São Paulo..."
                      placeholderTextColor="#94a3b8"
                      value={searchText}
                      onChangeText={handleSearchAddress}
                    />
                    {isSearching && <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 10 }} />}
                  </View>
                  <View style={styles.pickingInstructionRow}>
                    <FontAwesome6 name="hand-pointer" size={13} color="#2563eb" style={{ marginRight: 8 }} />
                    <Text style={styles.pickingInstructionText}>
                      Toque no mapa para marcar o local
                    </Text>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}

            {/* Painel de configuração após selecionar ponto */}
            {creatingStep === 'configuring' && selectedPoint && (
              <View style={[styles.configPanel, { bottom: Math.max(30, keyboardHeight + 10) }]}>
                <LinearGradient
                  colors={['#0f172a', '#1e293b']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.configPanelGradient}
                >
                  {/* Header */}
                  <View style={styles.configHeader}>
                    <View style={styles.configHeaderIcon}>
                      <FontAwesome6 name="eye" size={17} color="#60a5fa" />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.configTitle}>Novo Vigia</Text>
                      <Text style={styles.configSubtitle} numberOfLines={2}>
                        {loadingAddress
                          ? 'Buscando endereço...'
                          : selectedAddress || formatCoords(selectedPoint.latitude, selectedPoint.longitude)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setCreatingStep('picking');
                        setSelectedPoint(null);
                      }}
                      style={styles.configResetBtn}
                    >
                      <FontAwesome6 name="rotate-left" size={12} color="#94a3b8" />
                      <Text style={styles.configResetText}>Alterar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Nome */}
                  <Text style={styles.fieldLabel}>Nome do Vigia</Text>
                  <TextInput
                    style={styles.nameInput}
                    placeholder="Ex: Casa, Trabalho, Escola..."
                    placeholderTextColor="#475569"
                    value={vigiaName}
                    onChangeText={setVigiaName}
                    maxLength={40}
                    autoFocus={true}
                  />

                  {/* Raio - Opções discretas */}
                  <View style={styles.radiusHeader}>
                    <Text style={styles.fieldLabel}>Raio de Atuação</Text>
                  </View>
                  <View style={styles.radiusOptionsContainer}>
                    {RADIUS_OPTIONS.map((radiusOpt) => {
                      const isActive = vigiaRadius === radiusOpt;
                      return (
                        <TouchableOpacity
                          key={radiusOpt}
                          style={[
                            styles.radiusOptionBtn,
                            isActive && styles.radiusOptionBtnActive
                          ]}
                          onPress={() => setVigiaRadius(radiusOpt)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.radiusOptionText,
                              isActive && styles.radiusOptionTextActive
                            ]}
                          >
                            {formatRadius(radiusOpt)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Botão Salvar */}
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveVigia}
                    activeOpacity={0.8}
                  >
                    <FontAwesome6 name="check" size={14} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveBtnText}>Salvar Vigia</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            )}
          </>
        )}

        {/* ================= OVERLAY: MODO IDLE — BOTÕES DE AÇÃO ================= */}
        {uiMode === 'idle' && (
          <View style={styles.idleControls}>
            {/* Botão "Meu local" */}
            <View style={styles.fabRow}>
              <TouchableOpacity
                style={styles.locationFab}
                onPress={() => {
                  if (userLocation) {
                    mapRef.current?.animateToRegion({
                      latitude: userLocation.coords.latitude,
                      longitude: userLocation.coords.longitude,
                      latitudeDelta: 0.08,
                      longitudeDelta: 0.08,
                    });
                  }
                }}
              >
                <FontAwesome6 name="location-crosshairs" size={14} color="#333" />
                <Text style={styles.locationFabText}>Meu local</Text>
              </TouchableOpacity>
            </View>

            {/* Container com botões principais */}
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleStartCreating}
                activeOpacity={0.8}
              >
                <View style={styles.actionBtnIconWrap}>
                  <FontAwesome6 name="plus" size={14} color="#2563eb" />
                </View>
                <Text style={styles.actionBtnText}>Criar vigia</Text>
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleOpenListing}
                activeOpacity={0.8}
              >
                <View style={styles.actionBtnIconWrap}>
                  <FontAwesome6 name="list" size={14} color="#2563eb" />
                </View>
                <Text style={styles.actionBtnText}>Meus vigias</Text>
                {vigias.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{vigias.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ================= PAINEL RETRÁTIL: MEUS VIGIAS ================= */}
      <Animated.ScrollView
        style={[styles.scrollViewContainer, animatedScrollStyle]}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 14 }}
      >
        {/* Header do painel */}
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Meus Vigias</Text>
            <Text style={styles.panelSubtitle}>
              {vigias.length === 0
                ? 'Nenhum vigia criado ainda'
                : `${vigias.length} vigia${vigias.length > 1 ? 's' : ''} ativo${vigias.length > 1 ? 's' : ''}`
              }
            </Text>
          </View>
          <TouchableOpacity
            style={styles.panelCloseBtn}
            onPress={handleCloseListing}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="xmark" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Lista de vigias */}
        {vigias.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FontAwesome6 name="eye-slash" size={28} color="#475569" />
            </View>
            <Text style={styles.emptyTitle}>Nenhum vigia ativo</Text>
            <Text style={styles.emptyText}>
              Crie vigias para monitorar áreas específicas no mapa e receber alertas de atividade.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => {
                handleCloseListing();
                setTimeout(handleStartCreating, 350);
              }}
              activeOpacity={0.8}
            >
              <FontAwesome6 name="plus" size={12} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.emptyBtnText}>Criar primeiro vigia</Text>
            </TouchableOpacity>
          </View>
        ) : (
          vigias.map((vigia) => (
            <TouchableOpacity
              key={vigia.id}
              activeOpacity={0.85}
              onPress={() => handleFocusVigia(vigia)}
            >
              <LinearGradient
                colors={['#0f172a', '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.vigiaCard}
              >
                <View style={styles.vigiaCardHeader}>
                  <View style={styles.vigiaCardIcon}>
                    <FontAwesome6 name="eye" size={17} color="#60a5fa" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vigiaCardName}>{vigia.name}</Text>
                    <Text style={styles.vigiaCardCoords} numberOfLines={2} ellipsizeMode="tail">
                      {vigia.address || formatCoords(vigia.latitude, vigia.longitude)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.vigiaDeleteBtn}
                    onPress={() => setVigiaToDelete(vigia)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <FontAwesome6 name="trash-can" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <View style={styles.vigiaCardFooter}>
                  <View style={styles.vigiaCardTag}>
                    <FontAwesome6 name="circle-dot" size={10} color="#3b82f6" style={{ marginRight: 6 }} />
                    <Text style={styles.vigiaCardTagText}>Raio: {formatRadius(vigia.radius)}</Text>
                  </View>
                  <View style={styles.vigiaCardTag}>
                    <FontAwesome6 name="calendar" size={10} color="#64748b" style={{ marginRight: 6 }} />
                    <Text style={styles.vigiaCardTagText}>{formatDate(vigia.createdAt)}</Text>
                  </View>
                  <View style={styles.vigiaCardFocusHint}>
                    <Text style={styles.vigiaCardFocusText}>Ver no mapa</Text>
                    <FontAwesome6 name="location-arrow" size={10} color="#60a5fa" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        )}
      </Animated.ScrollView>

      {/* Modal de Confirmação de Exclusão */}
      <Modal
        transparent
        visible={!!vigiaToDelete}
        animationType="fade"
        onRequestClose={() => setVigiaToDelete(null)}
      >
        <View style={styles.deleteModalOverlay}>
          <Animated.View entering={FadeInUp.duration(250).springify()} style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconWrapper}>
              <FontAwesome6 name="trash-can" size={24} color="#dc2626" />
            </View>
            <Text style={styles.deleteModalTitle}>Remover Vigia?</Text>
            <Text style={styles.deleteModalText}>
              Tem certeza que deseja remover o vigia{vigiaToDelete ? ` "${vigiaToDelete.name}"` : ''}? Esta ação não poderá ser desfeita.
            </Text>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => setVigiaToDelete(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteModalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteModalConfirmButton}
                onPress={handleConfirmDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteModalConfirmText}>Remover</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ================= VIGIA MARKER ================= */
  vigiaMarkerWrapper: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  targetCallout: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  targetCalloutText: {
    color: '#1e293b',
    fontFamily: 'texgyB',
    fontSize: 11,
  },

  /* ================= MODO CRIAÇÃO ================= */
  cancelBtn: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 22,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.15)',
    zIndex: 20,
  },
  cancelBtnText: {
    fontFamily: 'texgyB',
    fontSize: 13,
    color: '#dc2626',
  },

  bottomOverlayContainer: {
    position: 'absolute',
    alignSelf: 'center',
    width: '84%',
    maxWidth: 340,
    zIndex: 15,
  },
  pickingCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  pickingInstructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  pickingInstructionText: {
    fontFamily: 'texgyB',
    fontSize: 12,
    color: '#1e293b',
    textAlign: 'center',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'texgyR',
    fontSize: 14,
    color: '#1e293b',
    paddingVertical: 0,
  },
  searchResultsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 20,
    marginBottom: 10,
    paddingVertical: 8,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  searchResultText: {
    fontFamily: 'texgyR',
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },

  configPanel: {
    position: 'absolute',
    bottom: 30,
    left: 12,
    right: 12,
    zIndex: 15,
  },
  configPanelGradient: {
    borderRadius: 20,
    padding: 18,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },

  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  configHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  configTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'texgyB',
  },
  configSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: 'GlacialR',
    marginTop: 2,
  },
  configResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  configResetText: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'texgyR',
    marginLeft: 5,
  },

  fieldLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'texgyB',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: '#fff',
    fontFamily: 'texgyR',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 16,
  },

  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  radiusOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 8,
  },
  radiusOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radiusOptionBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  radiusOptionText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'texgyR',
  },
  radiusOptionTextActive: {
    color: '#60a5fa',
    fontFamily: 'texgyB',
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 3,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'texgyB',
  },

  /* ================= MODO IDLE — BOTÕES ================= */
  idleControls: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  fabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  locationFab: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  locationFabText: {
    fontFamily: 'texgyB',
    fontSize: 13,
    color: '#000',
    marginLeft: 6,
  },

  actionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    paddingVertical: 6,
    paddingHorizontal: 8,
    minWidth: 220,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionBtnIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionBtnText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
  },
  countBadge: {
    backgroundColor: '#2563eb',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'texgyB',
  },

  /* ================= PAINEL RETRÁTIL ================= */
  scrollViewContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.6,
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
  },

  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  panelTitle: {
    fontSize: 20,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  panelSubtitle: {
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#64748b',
    marginTop: 2,
  },
  panelCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ================= EMPTY STATE ================= */
  emptyState: {
    alignItems: 'center',
    marginHorizontal: 20,
    paddingVertical: 32,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'texgyB',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    elevation: 3,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'texgyB',
  },

  /* ================= VIGIA CARD ================= */
  vigiaCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  vigiaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  vigiaCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  vigiaCardName: {
    fontSize: 16,
    fontFamily: 'texgyB',
    color: '#fff',
  },
  vigiaCardCoords: {
    fontSize: 12,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 16,
  },
  vigiaDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  vigiaCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  vigiaCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  vigiaCardTagText: {
    fontSize: 12,
    fontFamily: 'texgyR',
    color: '#94a3b8',
  },
  vigiaCardFocusHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 4,
  },
  vigiaCardFocusText: {
    fontSize: 12,
    fontFamily: 'texgyB',
    color: '#60a5fa',
  },

  /* ================= MODAL EXCLUSÃO ================= */
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  deleteModalIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 19,
    fontFamily: 'texgyB',
    color: '#0f172a',
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 13.5,
    fontFamily: 'texgyR',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#475569',
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#fff',
  },
});