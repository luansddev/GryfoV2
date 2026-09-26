import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Dimensions, Keyboard, KeyboardAvoidingView, TextInput, LayoutAnimation, ActivityIndicator } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef } from 'react';
import { Alert, RefreshControl, Modal } from 'react-native';
import { Marker, Region, MapPressEvent } from 'react-native-maps';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { lifeCrimesKeys, physicalCrimesKeys, patrimonyCrimesKeys } from '../../constants/CrimeData';

// Helper to determine the color of the marker
const getRelatoColor = (natureza?: string) => {
  if (!natureza) return '#64748b'; // default cinza
  const up = natureza.toUpperCase();
  if (lifeCrimesKeys.includes(up)) return '#000000'; // Preto
  if (physicalCrimesKeys.includes(up)) return '#dc2626'; // Vermelho
  if (patrimonyCrimesKeys.includes(up)) return '#64748b'; // Cinza
  return '#64748b'; // fallback cinza
};
import * as Location from 'expo-location';
import AddRelatoModal from '../../components/AddRelatoModal';
import { db, auth } from '../../config/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSearchLocation } from '../../context/SearchLocationContext';
import { normalizarCidade } from '../../context/Normalizer';
import { getCrimeIcon, formatCrimeName } from '../../constants/CrimeData';
import { getDeviceId } from '../../utils/device';
import Animated, { FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import RelatoItem from '../../components/RelatoItem';
import { useVigiaCreation } from '../../context/VigiaCreationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSharedMap } from '../../context/SharedMapContext';



export default function Relatos() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [relatos, setRelatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { searchMode, searchedCity, userCity } = useSearchLocation();
  const { setIsCreatingVigia } = useVigiaCreation();
  const [uiMode, setUiMode] = useState<'idle' | 'creating_relato'>('idle');
  const [selectedRelatoId, setSelectedRelatoId] = useState<string | null>(null);
  const [creatingStep, setCreatingStep] = useState<'picking' | 'configuring'>('picking');
  const [selectedPoint, setSelectedPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [visitorModalInfo, setVisitorModalInfo] = useState<{clickedCity: string, physicalCity: string} | null>(null);
  const [noLocationModalVisible, setNoLocationModalVisible] = useState(false);
  
  const [activeDraftText, setActiveDraftText] = useState<string | null>(null);
  const [activeDraftCrime, setActiveDraftCrime] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | undefined>(undefined);

  const openAddRelatoModal = () => {
    setUiMode('idle');
    setIsCreatingVigia(false);
    setCreatingStep('picking');
    setIsAddModalVisible(true);
  };

  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchedPoint, setSearchedPoint] = useState<{ latitude: number; longitude: number } | null>(null);

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  useEffect(() => {
    if (params.editDraftId) {
      const draftId = params.editDraftId as string;
      const fetchDraft = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'rascunhos', draftId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setActiveDraftText(data.texto || null);
            setActiveDraftCrime(data.crimeKey || null);
            setActiveDraftId(draftId);
            if (data.latitude && data.longitude) {
              setSelectedPoint({ latitude: data.latitude, longitude: data.longitude });
              setSelectedCityName(data.cidade || null);
              mapRef.current?.animateToRegion({
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              });
            }
            setUiMode('creating_relato');
            setIsCreatingVigia(true);
            setCreatingStep('picking');
            setIsAddModalVisible(false);
          }
        } catch (e) {
          console.error("Erro buscando rascunho: ", e);
        }
      };
      fetchDraft();
    }
  }, [params.editDraftId]);

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
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  const formatCityForDisplay = (city: string) => {
    return city.replace(/\bS\./i, 'São ').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const fetchAddressInfo = async (latitude: number, longitude: number): Promise<{ address: string, cityName: string | null }> => {
    let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    let cityName: string | null = null;
    
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const item = results[0];
        cityName = item.city || item.subregion || null;
        
        const street = item.street || item.name || '';
        const number = item.streetNumber ? `, ${item.streetNumber}` : '';
        const district = item.district || item.subregion ? ` - ${item.district || item.subregion}` : '';
        const cityStr = item.city ? `, ${item.city}` : '';
        const formatted = `${street}${number}${district}${cityStr}`.replace(/^[\s,-]+/, '').trim();
        if (formatted.length > 3) {
           address = formatted;
        }
      }
    } catch (e) { }

    if (!cityName || address === `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt-BR`,
          { headers: { 'User-Agent': 'Gryfo/1.0' } }
        );
        const data = await res.json();
        if (data && data.address) {
          cityName = data.address.city || data.address.town || data.address.municipality || cityName;
          
          const road = data.address.road || data.address.pedestrian || data.address.suburb || '';
          const num = data.address.house_number ? `, ${data.address.house_number}` : '';
          const suburb = data.address.suburb || data.address.neighbourhood ? ` - ${data.address.suburb || data.address.neighbourhood}` : '';
          const cityStr = data.address.city || data.address.town || data.address.municipality || '';
          const formatted = `${road}${num}${suburb}${cityStr ? `, ${cityStr}` : ''}`.replace(/^[\s,-]+/, '').trim();
          
          if (formatted.length > 3) {
            address = formatted;
          } else if (data.display_name) {
            address = data.display_name.split(',').slice(0, 3).join(',');
          }
        }
      } catch (err) {}
    }
    
    return { address, cityName };
  };

  const handleMapPress = async (e: MapPressEvent) => {
    if (uiMode !== 'creating_relato') return;
    const { latitude, longitude } = e.nativeEvent.coordinate;

    setLoadingAddress(true);
    
    try {
      const { address, cityName } = await fetchAddressInfo(latitude, longitude);
      setSelectedCityName(cityName);
      
      setSelectedPoint({ latitude, longitude });
      setSearchedPoint(null);
      setCreatingStep('configuring');
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      setSelectedAddress(address);
    } catch {
      // Se a rede falhar, permite continuar com coordenadas puras
      setSelectedCityName(null);
      setSelectedPoint({ latitude, longitude });
      setSelectedAddress(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      setCreatingStep('configuring');
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleCancelCreating = () => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setUiMode('idle');
    setIsCreatingVigia(false);
    setCreatingStep('picking');
    setSelectedPoint(null);
    setSelectedAddress(null);
    setSelectedCityName(null);
    setActiveDraftText(null);
    setActiveDraftCrime(null);
    setActiveDraftId(undefined);
    setLoadingAddress(false);
    setSearchedPoint(null);
    setSearchText('');
    setSearchResults([]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const { mapRef, region: sharedRegion, registerMapChildren, setMapPressHandler, setMapInteractionEnabled, userLocation: sharedUserLocation, activeTab, setIsCreatingRelato } = useSharedMap();
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          if (!isMounted) return;
          setUserLocation(loc);
          mapRef.current?.animateToRegion({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          });
        }
      } catch (error) {
        console.warn('Erro ao obter localização:', error);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Only control map interaction when this tab (relatos = index 1) is active
  useEffect(() => {
    if (activeTab === 1) {
      setMapInteractionEnabled(viewMode === 'map' || uiMode === 'creating_relato');
    }
  }, [viewMode, uiMode, setMapInteractionEnabled, activeTab]);

  useEffect(() => {
    if (uiMode === 'creating_relato') {
      setMapPressHandler('relatos', handleMapPress);
      setIsCreatingRelato(true);
    } else {
      setMapPressHandler('relatos', undefined);
      setIsCreatingRelato(false);
    }
  }, [uiMode, handleMapPress, setMapPressHandler, setIsCreatingRelato]);

  useEffect(() => {
    const markersToRender = (
      <>
        {relatos.map(relato => {
          if (!relato.latitude || !relato.longitude) return null;
          const markerColor = getRelatoColor(relato.crimeKey);
          return (
            <Marker
              key={`marker-${relato.id}`}
              coordinate={{ latitude: relato.latitude, longitude: relato.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
                if (uiMode !== 'creating_relato') {
                  setSelectedRelatoId(relato.id);
                }
              }}
            >
              <View style={{ alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}>
                <Svg width={32} height={32} viewBox="0 0 24 24">
                  <Path
                    d="M2 4c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-6l-2 6-2-6H4c-1.1 0-2-.9-2-2V4z"
                    fill={markerColor}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                </Svg>
              </View>
            </Marker>
          )
        })}
        {uiMode === 'creating_relato' && searchedPoint && (
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

        {uiMode === 'creating_relato' && selectedPoint && (
          <Marker
            coordinate={selectedPoint}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={true}
          >
            <View style={styles.vigiaMarkerWrapper} collapsable={false}>
              <Svg width={40} height={40} viewBox="0 0 40 40">
                <SvgCircle cx="20" cy="20" r="18" fill="rgba(255, 255, 255, 0.3)" stroke="#fff" strokeWidth={2} strokeDasharray="4 4" />
                <SvgCircle cx="20" cy="20" r="4" fill="#fff" />
                <Path d="M20 2v6M20 38v-6M2 20h6M38 20h-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
          </Marker>
        )}
      </>
    );
    registerMapChildren('relatos', markersToRender);
  }, [relatos, uiMode, searchedPoint, selectedPoint, registerMapChildren]);

  useEffect(() => {
    if (params.focusLat && params.focusLng) {
      setViewMode('map');
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: parseFloat(params.focusLat as string),
          longitude: parseFloat(params.focusLng as string),
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }, 500);
    }
  }, [params.focusLat, params.focusLng]);

  useEffect(() => {
    let deviceId = '';
    getDeviceId().then(id => {
      deviceId = id;
      setCurrentDeviceId(auth.currentUser?.uid || deviceId);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentDeviceId(user.uid);
      } else if (deviceId) {
        setCurrentDeviceId(deviceId);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (searchMode && !searchedCity) {
      setRelatos([]);
      setLoading(false);
      return;
    }

    setLoading(true); // Ativa o estado de carregamento para fazer uma transição suave
    const rawCity = (searchMode && searchedCity) ? searchedCity : (userCity || 'S.PAULO');
    const city = normalizarCidade(rawCity);

    const q = query(
      collection(db, 'relatos'),
      where('cidade', '==', city),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordena localmente: maior quantidade de upvotes primeiro. Em caso de empate, o mais recente.
      data.sort((a: any, b: any) => {
        const upA = a.upvotes || 0;
        const upB = b.upvotes || 0;
        if (upB !== upA) {
          return upB - upA;
        }
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setRelatos(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao escutar relatos:", error);
      // Fallback pra criar index ou ignorar erro
      setLoading(false);
    });

    return () => unsubscribe();
  }, [searchMode, searchedCity, userCity]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* LISTA DE RELATOS */}
      {viewMode === 'list' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#3b82f6"
                colors={['#3b82f6']} // Para Android
                progressViewOffset={120} // Adicionado para descer a bolinha
              />
            }
          >
            {loading ? (
              <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 40 }} />
            ) : (searchMode && !searchedCity) ? (
              <View style={{ alignItems: 'center', marginTop: 80 }}>
                <FontAwesome6 name="magnifying-glass-location" size={48} color="#cbd5e1" />
                <Text style={{ marginTop: 16, fontSize: 16, color: '#64748b', fontWeight: '500' }}>
                  Aguardando pesquisa de cidade...
                </Text>
              </View>
            ) : relatos.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 80 }}>
                <FontAwesome6 name="inbox" size={48} color="#cbd5e1" />
                <Text style={{ marginTop: 16, fontSize: 16, color: '#64748b', fontWeight: '500' }}>
                  Nenhum relato encontrado nesta região.
                </Text>
              </View>
            ) : (
              relatos.map((relato, index) => (
                <RelatoItem 
                  key={relato.id} 
                  relato={relato} 
                  currentDeviceId={currentDeviceId} 
                  index={index} 
                  showOwnerBadge={true} 
                  onViewOnMap={(r) => {
                    setViewMode('map');
                    mapRef.current?.animateToRegion({
                      latitude: r.latitude,
                      longitude: r.longitude,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    });
                  }}
                />
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* CONTROLES INFERIORES */}
      {uiMode === 'idle' && (
        <View style={styles.idleControls} pointerEvents="box-none">
          {viewMode === 'map' && (
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
        )}

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setUiMode('creating_relato');
              setIsCreatingVigia(true);
              setCreatingStep('picking');
              setSelectedPoint(null);
              setSelectedAddress(null);
              setLoadingAddress(false);
              setSearchedPoint(null);
              setSearchText('');
              setSearchResults([]);
              if (viewMode === 'list') setViewMode('map');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.actionBtnIconWrap}>
              <FontAwesome6 name="plus" size={14} color="#2563eb" />
            </View>
            <Text style={styles.actionBtnText}>Criar relato</Text>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionBtnIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <FontAwesome6 name={viewMode === 'map' ? "list" : "map"} size={14} color="#10b981" />
              {viewMode === 'map' && relatos.length > 0 && (
                <View style={[styles.countBadge, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.countBadgeText}>{relatos.length}</Text>
                </View>
              )}
            </View>
            <Text style={styles.actionBtnText}>{viewMode === 'map' ? "Ver relatos" : "Ver mapa"}</Text>
          </TouchableOpacity>

          <View style={styles.actionDivider} />

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/biblioteca')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionBtnIconWrap, { backgroundColor: 'rgba(71, 85, 105, 0.1)' }]}>
              <FontAwesome6 name="book-bookmark" size={14} color="#475569" />
            </View>
            <Text style={styles.actionBtnText}>Biblioteca</Text>
          </TouchableOpacity>
        </View>
      </View>
      )}

      {uiMode === 'creating_relato' && (
        <>
          <TouchableOpacity
            style={[styles.cancelBtn, { top: insets.top + 16 }]}
            onPress={handleCancelCreating}
            activeOpacity={0.8}
          >
            <FontAwesome6 name="xmark" size={13} color="#dc2626" style={{ marginRight: 6 }} />
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>

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
                <TouchableOpacity
                  style={{ marginTop: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', padding: 8 }}
                  onPress={() => {
                    handleCancelCreating();
                    setNoLocationModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontFamily: 'texgyB', color: '#64748b', fontSize: 13, marginRight: 5 }}>Pular localização e descrever</Text>
                  <FontAwesome6 name="arrow-right" size={12} color="#64748b" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}

          {creatingStep === 'configuring' && selectedPoint && (
            <View style={[styles.configPanel, { bottom: Math.max(30, keyboardHeight + 10) }]}>
              <LinearGradient
                colors={['#0f172a', '#1e293b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.configPanelGradient}
              >
                <View style={styles.configHeader}>
                  <View style={styles.configHeaderIcon}>
                    <FontAwesome6 name="map-location-dot" size={17} color="#60a5fa" />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.configTitle}>Novo Relato</Text>
                    <Text style={styles.configSubtitle} numberOfLines={2}>
                      {loadingAddress
                        ? 'Buscando endereço...'
                        : selectedAddress || `${selectedPoint.latitude.toFixed(4)}, ${selectedPoint.longitude.toFixed(4)}`}
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

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={() => {
                    const physicalCityNormalized = normalizarCidade(userCity || 'São Paulo');
                    const clickedCityNormalized = selectedCityName ? normalizarCidade(selectedCityName) : null;
                    
                    if (clickedCityNormalized && clickedCityNormalized !== physicalCityNormalized) {
                      setVisitorModalInfo({ clickedCity: selectedCityName!, physicalCity: userCity || 'São Paulo' });
                    } else {
                      openAddRelatoModal();
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.saveBtnText}>Continuar Relato</Text>
                  <FontAwesome6 name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}
        </>
      )}

      {selectedRelatoId && relatos.find(r => r.id === selectedRelatoId) && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 400 }}>
              <TouchableOpacity
                style={{ alignSelf: 'center', marginBottom: 16, backgroundColor: '#fff', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 3.84 }}
                onPress={() => setSelectedRelatoId(null)}
                activeOpacity={0.8}
              >
                <FontAwesome6 name="xmark" size={20} color="#333" />
              </TouchableOpacity>
              <RelatoItem
                relato={relatos.find(r => r.id === selectedRelatoId)}
                currentDeviceId={currentDeviceId}
                index={0}
                showOwnerBadge={true}
              />
            </View>
          </View>
        </View>
      )}

      {/* VISITOR WARNING MODAL */}
      <Modal visible={!!visitorModalInfo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.customModalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#fef3c7' }]}>
              <FontAwesome6 name="map-location-dot" size={24} color="#d97706" />
            </View>
            <Text style={styles.modalTitle}>Aviso de Visitante</Text>
            <Text style={styles.modalText}>
              Você está fisicamente em <Text style={{ fontFamily: 'texgyB' }}>{formatCityForDisplay(visitorModalInfo?.physicalCity || '')}</Text>, e tentando criar um relato em <Text style={{ fontFamily: 'texgyB' }}>{formatCityForDisplay(visitorModalInfo?.clickedCity || '')}</Text>. Seu relato será marcado com uma legenda de visitante.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setVisitorModalInfo(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => {
                setVisitorModalInfo(null);
                openAddRelatoModal();
              }}>
                <Text style={styles.modalConfirmText}>Prosseguir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* NO LOCATION WARNING MODAL */}
      <Modal visible={noLocationModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.customModalCard}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#e0e7ff' }]}>
              <FontAwesome6 name="location-crosshairs" size={24} color="#4f46e5" />
            </View>
            <Text style={styles.modalTitle}>Localização Padrão</Text>
            <Text style={styles.modalText}>
              Por não selecionar um local no mapa, seu relato será associado a sua localização atual: <Text style={{ fontFamily: 'texgyB' }}>{formatCityForDisplay(userCity || 'São Paulo')}</Text>.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setNoLocationModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => {
                setNoLocationModalVisible(false);
                openAddRelatoModal();
              }}>
                <Text style={styles.modalConfirmText}>Prosseguir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AddRelatoModal
        visible={isAddModalVisible}
        onClose={() => {
          setIsAddModalVisible(false);
          setSelectedPoint(null);
          setSelectedCityName(null);
          setActiveDraftText(null);
          setActiveDraftCrime(null);
          setActiveDraftId(undefined);
        }}
        initialLocation={selectedPoint}
        initialCityName={selectedCityName}
        draftData={(activeDraftText || activeDraftCrime) ? { texto: activeDraftText || '', crimeKey: activeDraftCrime } : undefined}
        draftId={activeDraftId}
        onChangeLocation={(text, crimeKey) => {
          setActiveDraftText(text);
          setActiveDraftCrime(crimeKey);
          setIsAddModalVisible(false);
          setCreatingStep('picking');
          setUiMode('creating_relato');
          setIsCreatingVigia(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingTop: 180,
    paddingHorizontal: 20,
    paddingBottom: 180,
  },
  idleControls: {
    position: 'absolute',
    bottom: 110,
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
    fontWeight: 'bold',
    fontSize: 13,
    color: '#000',
    marginLeft: 6,
  },
  actionContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 260,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 74,
  },
  actionBtnIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  actionBtnText: {
    fontFamily: 'texgyB',
    fontWeight: 'bold',
    fontSize: 11,
    color: '#1e293b',
    textAlign: 'center',
  },
  actionDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#e2e8f0',
    marginHorizontal: 2,
  },
  countBadge: {
    backgroundColor: '#2563eb',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -4,
    right: -4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  customModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'texgyB',
    fontSize: 20,
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalText: {
    fontFamily: 'texgyR',
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: 'texgyB',
    color: '#64748b',
    fontSize: 14,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontFamily: 'texgyB',
    color: '#ffffff',
    fontSize: 14,
  },
});

