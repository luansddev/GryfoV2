import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  LayoutAnimation,
  Modal,
} from 'react-native';

import { Marker, Region } from 'react-native-maps';
import { useSharedMap } from '../../context/SharedMapContext';
import Supercluster from 'supercluster';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import * as Location from 'expo-location';
import { useSearchLocation } from '../../context/SearchLocationContext';
import { normalizarCidade } from '../../context/Normalizer';

import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import {
  lifeCrimesKeys,
  physicalCrimesKeys,
  patrimonyCrimesKeys,
  formatCrimeName,
  getCrimeIcon,
  mapNatureOptions,
} from '../../constants/CrimeData';

/* ================= CHAVES E FORMATADORES ================= */


const arcPath = (startAngle: number, endAngle: number, radius: number, innerRadius: number, centerX: number, centerY: number) => {
  const angle = endAngle - startAngle;
  const largeArcFlag = angle > Math.PI ? 1 : 0;

  const x1 = centerX + Math.cos(startAngle) * radius;
  const y1 = centerY + Math.sin(startAngle) * radius;
  const x2 = centerX + Math.cos(endAngle) * radius;
  const y2 = centerY + Math.sin(endAngle) * radius;

  if (angle >= Math.PI * 2 - 0.001) {
    if (innerRadius === 0) {
      return `
        M ${centerX} ${centerY - radius}
        A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius}
        A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius}
        Z
      `;
    }
    return `
      M ${centerX} ${centerY - radius}
      A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius}
      A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius}
      Z
      M ${centerX} ${centerY - innerRadius}
      A ${innerRadius} ${innerRadius} 0 1 0 ${centerX} ${centerY + innerRadius}
      A ${innerRadius} ${innerRadius} 0 1 0 ${centerX} ${centerY - innerRadius}
      Z
    `;
  }

  if (innerRadius === 0) {
    return `
      M ${centerX} ${centerY}
      L ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
      Z
    `;
  }

  const ix1 = centerX + Math.cos(endAngle) * innerRadius;
  const iy1 = centerY + Math.sin(endAngle) * innerRadius;
  const ix2 = centerX + Math.cos(startAngle) * innerRadius;
  const iy2 = centerY + Math.sin(startAngle) * innerRadius;

  return `
    M ${x1} ${y1}
    A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
    L ${ix1} ${iy1}
    A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix2} ${iy2}
    Z
  `;
};

/* ================= OPÇÕES DE CATEGORIAS DOS CARDS ================= */

const categoryOptions = [
  {
    id: 'general' as const,
    label: 'Visão Geral',
    subtitle: 'Panorama consolidado do município',
    icon: 'layer-group',
    color: '#07268a',
  },
  {
    id: 'life' as const,
    label: 'Crimes contra a Vida',
    subtitle: 'Homicídios, latrocínios e mortes',
    icon: 'skull-crossbones',
    color: '#000000',
  },
  {
    id: 'physical' as const,
    label: 'Integridade Física',
    subtitle: 'Lesões corporais e dignidade sexual',
    icon: 'person-falling-burst',
    color: '#dc2626',
  },
  {
    id: 'patrimony' as const,
    label: 'Crimes contra o Patrimônio',
    subtitle: 'Roubos, furtos e veículos',
    icon: 'building-shield',
    color: '#475569',
  },
];


/* ================= COMPONENTE PRINCIPAL ================= */

export default function Dados() {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [dadosCidade, setDadosCidade] = useState<any>(null);
  const [allCitiesData, setAllCitiesData] = useState<any>(null);
  const [mapExpanded, setMapExpanded] = useState(true);

  const [selectedTab, setSelectedTab] = useState<'general' | 'life' | 'physical' | 'patrimony'>('general');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [selectedSubFilters, setSelectedSubFilters] = useState<string[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [modalNatureDropdownOpen, setModalNatureDropdownOpen] = useState(false);

  // Filtro ativo na legenda do mapa: 'life' | 'physical' | 'patrimony' (NÃO contém 'general')
  const [mapFilter, setMapFilter] = useState<'life' | 'physical' | 'patrimony'>('life');

  const handleCloseFilterModal = () => {
    setModalNatureDropdownOpen(false);
    setIsFilterDropdownOpen(false);
  };

  const translateY = useSharedValue(Dimensions.get('window').height);

  useEffect(() => {
    if (mapExpanded) {
      translateY.value = withTiming(Dimensions.get('window').height, { duration: 250 });
    } else {
      translateY.value = withTiming(0, { duration: 250 });
    }
  }, [mapExpanded]);

  const animatedScrollStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const { location: searchedLocation, searchMode, searchedCity, userCity } = useSearchLocation();
  const { mapRef, region: sharedRegion, registerMapChildren } = useSharedMap();

  const [region, setRegion] = useState<Region>({
    latitude: -23.5505,
    longitude: -46.6333,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const [lifeClusters, setLifeClusters] = useState<any[]>([]);
  const [physicalClusters, setPhysicalClusters] = useState<any[]>([]);
  const [patrimonyClusters, setPatrimonyClusters] = useState<any[]>([]);
  const [cityName, setCityName] = useState<string>('Localizando...');

  const lifeSupercluster = useRef(new Supercluster({ radius: 50, maxZoom: 16 })).current;
  const physicalSupercluster = useRef(new Supercluster({ radius: 50, maxZoom: 16 })).current;
  const patrimonySupercluster = useRef(new Supercluster({ radius: 50, maxZoom: 16 })).current;

  /* ================= GEO + DADOS ================= */

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

        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        });

        // Anima o mapa para a localização do usuário imediatamente
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        });

        // Reverse geocoding via REST API (evita o Geocoder nativo instável)
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&format=json&accept-language=pt-BR`,
            { headers: { 'User-Agent': 'Gryfo/1.0' } }
          );
          const geoJson = await geoRes.json();
          if (!isMounted) return;

          const nomeEncontrado = geoJson?.address?.city || geoJson?.address?.town || geoJson?.address?.municipality || 'Desconhecida';
          setCityName(nomeEncontrado);

          const cidade = normalizarCidade(nomeEncontrado);

          const res = await fetch('https://gryfocorp.web.app/ssp-2-2026.json');
          const json = await res.json();
          if (!isMounted) return;

          setAllCitiesData(json);
          // Se não encontrou a cidade em SP, ou se o usuário estiver fora, vamos padronizar para "S.PAULO" caso não ache
          const defaultCity = json[cidade] ? cidade : 'S.PAULO';
          setDadosCidade(json[defaultCity] || null);
          if (!json[cidade]) {
             setCityName('São Paulo');
          }
        } catch (geoError) {
          console.warn('Geocoder/dados indisponível:', geoError);
        }
      } catch (error) {
        console.warn('Erro ao obter localização:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  /* ================= GEO + DADOS ================= */

  useEffect(() => {
    if (!allCitiesData) return;

    if (searchMode && searchedCity && searchedLocation) {
      // O usuário buscou uma cidade, então atualizamos os dados
      setDadosCidade(allCitiesData[searchedCity] || null);
      
      mapRef.current?.animateToRegion({
        latitude: searchedLocation.latitude,
        longitude: searchedLocation.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });

      // Formatar nome para exibição (Primeira Letra Maiúscula)
      const formattedName = searchedCity.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      setCityName(formattedName);
    } else if (!searchMode && userCity) {
      // Voltou ao modo normal (desativou a busca)
      const defaultCity = allCitiesData[userCity] ? userCity : 'S.PAULO';
      setDadosCidade(allCitiesData[defaultCity] || null);
      
      if (userLocation) {
        mapRef.current?.animateToRegion({
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        });
        
        const formattedName = defaultCity.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setCityName(formattedName);
      }
    }
  }, [searchMode, searchedCity, searchedLocation, userCity, allCitiesData]);

  /* ================= SINCRONIZAÇÃO E NAVEGAÇÃO ================= */

  // Ao alternar entre mapa tela cheia e área de dados
  const handleToggleMap = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (mapExpanded) {
      // Abrindo os dados: abre na aba correspondente ao filtro do mapa
      setSelectedTab(mapFilter);
    } else {
      // Voltando para o mapa em tela cheia:
      // Se estiver em 'general', abre o mapa em 'life'; caso contrário, sincroniza com selectedTab
      if (selectedTab === 'general') {
        setMapFilter('life');
      } else {
        setMapFilter(selectedTab);
      }
    }
    setMapExpanded(prev => !prev);
  };

  // Ao selecionar uma das 4 abas no topo dos cards
  const handleSelectTab = (tab: 'general' | 'life' | 'physical' | 'patrimony') => {
    setSelectedTab(tab);
    if (tab !== 'general') {
      setMapFilter(tab);
    }
  };

  /* ================= SUPERCLUSTER UPDATES ================= */

  const updateClusters = (reg: Region, dados: any = dadosCidade) => {
    if (!dados) return;

    const bbox: [number, number, number, number] = [
      reg.longitude - reg.longitudeDelta,
      reg.latitude - reg.latitudeDelta,
      reg.longitude + reg.longitudeDelta,
      reg.latitude + reg.latitudeDelta
    ];
    const zoom = Math.max(0, Math.min(20, Math.round(Math.log2(360 / reg.longitudeDelta))));

    setLifeClusters(lifeSupercluster.getClusters(bbox, zoom));
    setPhysicalClusters(physicalSupercluster.getClusters(bbox, zoom));
    setPatrimonyClusters(patrimonySupercluster.getClusters(bbox, zoom));
  };

  useEffect(() => {
    if (dadosCidade) {
      if (mapFilter === 'life') {
        const lifePoints: any[] = [];
        lifeCrimesKeys.forEach(key => {
          if (selectedSubFilters.length > 0 && !selectedSubFilters.includes(key)) return;
          dadosCidade[key]?.localizacoes?.forEach((loc: any, idx: number) => {
            lifePoints.push({
              type: 'Feature',
              properties: { id: `life-${key}-${idx}`, crime: key, title: formatCrimeName(key), cluster: false },
              geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] }
            });
          });
        });
        lifeSupercluster.load(lifePoints);
        physicalSupercluster.load([]);
        patrimonySupercluster.load([]);
      } else if (mapFilter === 'physical') {
        const physicalPoints: any[] = [];
        physicalCrimesKeys.forEach(key => {
          if (selectedSubFilters.length > 0 && !selectedSubFilters.includes(key)) return;
          dadosCidade[key]?.localizacoes?.forEach((loc: any, idx: number) => {
            physicalPoints.push({
              type: 'Feature',
              properties: { id: `phys-${key}-${idx}`, crime: key, title: formatCrimeName(key), cluster: false },
              geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] }
            });
          });
        });
        physicalSupercluster.load(physicalPoints);
        lifeSupercluster.load([]);
        patrimonySupercluster.load([]);
      } else if (mapFilter === 'patrimony') {
        const patrimonyPoints: any[] = [];
        patrimonyCrimesKeys.forEach(key => {
          if (selectedSubFilters.length > 0 && !selectedSubFilters.includes(key)) return;
          dadosCidade[key]?.localizacoes?.forEach((loc: any, idx: number) => {
            patrimonyPoints.push({
              type: 'Feature',
              properties: { id: `patr-${key}-${idx}`, crime: key, title: formatCrimeName(key), cluster: false },
              geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] }
            });
          });
        });
        patrimonySupercluster.load(patrimonyPoints);
        lifeSupercluster.load([]);
        physicalSupercluster.load([]);
      }

      updateClusters(sharedRegion, dadosCidade);
    }
  }, [dadosCidade, selectedSubFilters, mapFilter, sharedRegion]);

  useEffect(() => {
    const markersToRender = (mapFilter === 'life' ? lifeClusters : mapFilter === 'physical' ? physicalClusters : patrimonyClusters).map(c => {
      const [longitude, latitude] = c.geometry.coordinates;
      const isCluster = c.properties?.cluster;
      const isLife = mapFilter === 'life';
      const isPhysical = mapFilter === 'physical';
      const bgColor = isLife ? '#000' : isPhysical ? '#FF0000' : '#666666';
      const dotStyle = isLife ? styles.markerDiamond : isPhysical ? styles.markerRedDiamond : styles.markerGrayDiamond;
      const supercluster = isLife ? lifeSupercluster : isPhysical ? physicalSupercluster : patrimonySupercluster;

      if (isCluster) {
        return (
          <Marker
            key={`${mapFilter}-cluster-${c.id}`}
            coordinate={{ latitude, longitude }}
            onPress={() => {
              const expansionZoom = supercluster.getClusterExpansionZoom(c.id as number);
              const zoomDelta = 360 / Math.pow(2, expansionZoom);
              mapRef.current?.animateToRegion({
                latitude, longitude,
                latitudeDelta: zoomDelta, longitudeDelta: zoomDelta
              });
            }}
            style={{ zIndex: c.properties.point_count + 1 }}
          >
            <View style={styles.clusterContainer}>
              <View style={[styles.clusterHalo, { backgroundColor: bgColor }]} />
              <View style={[styles.clusterCircle, { backgroundColor: bgColor }]}>
                <Text style={styles.clusterText}>{c.properties.point_count}</Text>
              </View>
            </View>
          </Marker>
        );
      }
      return (
        <Marker
          key={c.properties.id || `${mapFilter}-${c.properties.crime}-${latitude}-${longitude}`}
          coordinate={{ latitude, longitude }}
          title={c.properties.title}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.diamondWrapper}>
            <Svg width={26} height={26} viewBox="0 0 26 26">
              <Path 
                d="M13 3 L23 13 L13 23 L3 13 Z" 
                fill={bgColor} 
                stroke="#fff" 
                strokeWidth={2} 
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Marker>
      );
    });
    registerMapChildren('dados', <>{markersToRender}</>);
  }, [lifeClusters, physicalClusters, patrimonyClusters, mapFilter, registerMapChildren, mapRef]);

  useEffect(() => {
    setSelectedSubFilters([]);
  }, [mapFilter]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, fontFamily: 'texgyR', color: '#555' }}>Carregando dados...</Text>
      </View>
    );
  }

  /* ================= CALCULOS DAS ESTATÍSTICAS ================= */

  const stats = (() => {
    if (!dadosCidade) return { total: 0, top3: [], bottom3: [], chartData: [] };

    const counts: { name: string; count: number }[] = [];
    let total = 0;

    Object.keys(dadosCidade).forEach(key => {
      if (key === 'nome_da_cidade' || key === 'timestamp') return;
      const locs = dadosCidade[key]?.localizacoes;
      const count = Array.isArray(locs) ? locs.length : 0;
      if (count > 0) {
        counts.push({ name: key, count });
        total += count;
      }
    });

    counts.sort((a, b) => b.count - a.count);
    const top3 = counts.slice(0, 3);
    const bottom3 = counts.length > 3 ? counts.slice(-3).reverse() : [];

    const othersCount = counts.slice(3).reduce((acc, curr) => acc + curr.count, 0);

    const chartData = [
      ...top3.map(item => ({ name: formatCrimeName(item.name), count: item.count })),
    ];
    if (othersCount > 0) {
      chartData.push({ name: 'Outros crimes', count: othersCount });
    }

    return { total, top3, bottom3, chartData };
  })();

  const lifeCrimesStats = (() => {
    if (!dadosCidade) return { data: [], total: 0 };

    const data: { name: string; count: number }[] = [];
    let total = 0;

    lifeCrimesKeys.forEach(key => {
      const locs = dadosCidade[key]?.localizacoes;
      const count = Array.isArray(locs) ? locs.length : 0;
      data.push({ name: formatCrimeName(key), count });
      total += count;
    });

    data.sort((a, b) => b.count - a.count);
    return { data, total };
  })();

  const physicalCrimesStats = (() => {
    if (!dadosCidade) return { data: [], total: 0 };

    const dataMap: { [key: string]: number } = {};
    let total = 0;

    physicalCrimesKeys.forEach(key => {
      const fName = formatCrimeName(key);
      if (dataMap[fName] === undefined) dataMap[fName] = 0;

      const locs = dadosCidade[key]?.localizacoes;
      const count = Array.isArray(locs) ? locs.length : 0;
      dataMap[fName] += count;
      total += count;
    });

    const data = Object.keys(dataMap)
      .map(k => ({ name: k, count: dataMap[k] }))
      .sort((a, b) => b.count - a.count);
    return { data, total };
  })();

  const patrimonyCrimesStats = (() => {
    if (!dadosCidade) return { data: [], total: 0 };

    const dataMap: { [key: string]: number } = {};
    let total = 0;

    patrimonyCrimesKeys.forEach(key => {
      const fName = formatCrimeName(key);
      if (dataMap[fName] === undefined) dataMap[fName] = 0;

      const locs = dadosCidade[key]?.localizacoes;
      const count = Array.isArray(locs) ? locs.length : 0;
      dataMap[fName] += count;
      total += count;
    });

    const data = Object.keys(dataMap)
      .map(k => ({ name: k, count: dataMap[k] }))
      .sort((a, b) => b.count - a.count);
    return { data, total };
  })();

  /* ================= COMPONENTES VISUAIS EM LARGURA TOTAL ================= */

  // Barra comparativa de volume da categoria em relação ao total do município
  const renderVolumeComparison = (
    categoryName: string,
    categoryTotal: number,
    overallTotal: number,
    accentColor: string
  ) => {
    const pct = overallTotal > 0 ? ((categoryTotal / overallTotal) * 100).toFixed(1) : '0';
    const widthPct = overallTotal > 0 ? Math.max((categoryTotal / overallTotal) * 100, 3) : 0;

    return (
      <View style={styles.comparisonContainer}>
        <View style={styles.comparisonHeader}>
          <Text style={styles.comparisonTitle}>Representatividade no Município</Text>
          <View style={[styles.comparisonBadge, { borderColor: accentColor }]}>
            <Text style={[styles.comparisonBadgeText, { color: accentColor }]}>{pct}% do total</Text>
          </View>
        </View>
        <View style={styles.comparisonTrack}>
          <View style={[styles.comparisonFill, { width: `${widthPct}%`, backgroundColor: accentColor }]} />
        </View>
        <View style={styles.comparisonFooter}>
          <Text style={styles.comparisonFooterText}>
            <Text style={{ fontFamily: 'texgyB', color: '#fff' }}>{categoryTotal}</Text> em {categoryName}
          </Text>
          <Text style={styles.comparisonFooterSub}>
            Total geral: {overallTotal}
          </Text>
        </View>
      </View>
    );
  };

  // Lista detalhada com ícones específicos e barras de magnitude horizontal
  const renderCategoryCrimeList = (
    crimes: { name: string; count: number }[],
    totalCategory: number,
    barColor: string
  ) => {
    const maxCount = Math.max(...crimes.map(c => c.count), 1);

    return (
      <View style={styles.crimeListContainer}>
        {crimes.map((crime, index) => {
          const iconInfo = getCrimeIcon(crime.name);
          const pctOfCat = totalCategory > 0 ? ((crime.count / totalCategory) * 100).toFixed(1) : '0';
          const fillWidth = (crime.count / maxCount) * 100;

          return (
            <View key={index} style={styles.crimeDetailCard}>
              <View style={styles.crimeDetailTopRow}>
                <View style={[styles.crimeIconCircle, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <FontAwesome6 name={iconInfo.icon as any} size={14} color={iconInfo.color} />
                </View>
                <Text style={styles.crimeDetailName} numberOfLines={2}>
                  {crime.name}
                </Text>
                <View style={styles.crimeDetailCountBadge}>
                  <Text style={styles.crimeDetailCountText}>{crime.count}</Text>
                  <Text style={styles.crimeDetailCountPct}>{pctOfCat}%</Text>
                </View>
              </View>

              {/* Barra de magnitude visual sem corte */}
              <View style={styles.crimeDetailBarTrack}>
                <View
                  style={[
                    styles.crimeDetailBarFill,
                    {
                      width: `${Math.max(fillWidth, 2)}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  // Donut limpo para o panorama geral com legenda abaixo
  const renderGeneralDonut = () => {
    const { chartData, total } = stats;
    if (total === 0) return null;

    const radius = 55;
    const innerRadius = 35;
    const centerX = 70;
    const centerY = 70;
    const colors = ['#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#94a3b8'];

    let startAngle = -Math.PI / 2;

    return (
      <View style={styles.donutCard}>
        <View style={styles.donutSvgWrapper}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            {chartData.map((item, index) => {
              const angle = (item.count / total) * Math.PI * 2;
              if (angle <= 0) return null;
              const endAngle = startAngle + angle;
              const pathData = arcPath(startAngle, endAngle, radius, innerRadius, centerX, centerY);
              startAngle = endAngle;
              return <Path key={`slice-${index}`} d={pathData} fill={colors[index % colors.length]} />;
            })}
          </Svg>
          <View style={styles.donutCenterContent}>
            <FontAwesome6 name="chart-pie" size={16} color="#fff" />
            <Text style={styles.donutCenterLabel}>Proporção</Text>
          </View>
        </View>

        <View style={styles.donutLegendContainer}>
          {chartData.map((item, index) => {
            const color = colors[index % colors.length];
            const pct = ((item.count / total) * 100).toFixed(1);
            return (
              <View key={index} style={styles.donutLegendRow}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.donutLegendText} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.donutLegendCount}>
                  {item.count} <Text style={styles.donutLegendPct}>({pct}%)</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Donut para a distribuição interna da categoria
  const renderCategoryDonut = (categoryStats: { data: any[]; total: number }, colors: string[]) => {
    const { data, total } = categoryStats;
    if (total === 0) return null;

    const radius = 55;
    const innerRadius = 35;
    const centerX = 70;
    const centerY = 70;
    let startAngle = -Math.PI / 2;

    return (
      <View style={styles.donutCard}>
        <View style={styles.donutSvgWrapper}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            {data.map((item, index) => {
              const angle = (item.count / total) * Math.PI * 2;
              if (angle <= 0) return null;
              const endAngle = startAngle + angle;
              const pathData = arcPath(startAngle, endAngle, radius, innerRadius, centerX, centerY);
              startAngle = endAngle;
              return <Path key={`cat-slice-${index}`} d={pathData} fill={colors[index % colors.length]} />;
            })}
          </Svg>
          <View style={styles.donutCenterContent}>
            <Text style={styles.donutCenterNumber}>{total}</Text>
            <Text style={styles.donutCenterLabel}>total</Text>
          </View>
        </View>

        <View style={styles.donutLegendContainer}>
          {data.map((item, index) => {
            const color = colors[index % colors.length];
            const pct = ((item.count / total) * 100).toFixed(1);
            return (
              <View key={index} style={styles.donutLegendRow}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.donutLegendText} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.donutLegendCount}>
                  {item.count} <Text style={styles.donutLegendPct}>({pct}%)</Text>
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  /* ================= RENDER ================= */

  return (
    <View style={styles.container}>
      <View style={{ flex: 1, zIndex: 0 }}>
        {/* Controles sobre o mapa (Centralizados acima da tabbar ou acima dos cards) */}
        <View style={[styles.mapControlsWrapper, !mapExpanded && { bottom: Dimensions.get('window').height * 0.6 + 10 }]}>
          {mapExpanded && (
            <View style={styles.fabRowContainer}>
              <TouchableOpacity
                style={styles.locationFab}
                onPress={() => {
                  if (searchMode && searchedLocation) {
                    mapRef.current?.animateToRegion({
                      latitude: searchedLocation.latitude,
                      longitude: searchedLocation.longitude,
                      latitudeDelta: 0.08,
                      longitudeDelta: 0.08,
                    });
                  } else if (!searchMode && userLocation) {
                    mapRef.current?.animateToRegion({
                      latitude: userLocation.coords.latitude,
                      longitude: userLocation.coords.longitude,
                      latitudeDelta: 0.08,
                      longitudeDelta: 0.08,
                    });
                  }
                }}
              >
                <FontAwesome6 name={searchMode ? "location-dot" : "location-crosshairs"} size={14} color="#333" />
                <Text style={styles.locationFabText}>{searchMode ? "Ir ao local" : "Meu local"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterIconBtn}
                onPress={() => setIsFilterDropdownOpen(true)}
                activeOpacity={0.8}
              >
                <FontAwesome6 name="filter" size={14} color="#000" />
                {selectedSubFilters.length > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{selectedSubFilters.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.legendContainer, !mapExpanded && { backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0, padding: 0, width: 'auto' }]}>
            <TouchableOpacity
              style={[styles.toggleButton, !mapExpanded && styles.toggleButtonFloating]}
              onPress={handleToggleMap}
            >
              <FontAwesome6 name={mapExpanded ? "chart-pie" : "map"} size={14} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.toggleText}>
                {mapExpanded ? 'Ver dados' : 'Mapa em tela cheia'}
              </Text>
            </TouchableOpacity>

            {/* A legenda do mapa contém APENAS as 3 naturezas (nunca Geral) */}
            {mapExpanded && (
              <>
                <TouchableOpacity
                  style={[styles.legendButton, mapFilter === 'life' && styles.legendButtonActive]}
                  onPress={() => setMapFilter('life')}
                >
                  <View style={[styles.legendDiamond, { backgroundColor: '#000' }]} />
                  <Text style={[styles.legendText, mapFilter === 'life' && styles.legendTextActive]}>Crimes contra a Vida</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.legendButton, mapFilter === 'physical' && styles.legendButtonActive]}
                  onPress={() => setMapFilter('physical')}
                >
                  <View style={[styles.legendDiamond, { backgroundColor: '#FF0000' }]} />
                  <Text style={[styles.legendText, mapFilter === 'physical' && styles.legendTextActive]}>Integridade Física</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.legendButton, mapFilter === 'patrimony' && styles.legendButtonActive]}
                  onPress={() => setMapFilter('patrimony')}
                >
                  <View style={[styles.legendDiamond, { backgroundColor: '#666666' }]} />
                  <Text style={[styles.legendText, mapFilter === 'patrimony' && styles.legendTextActive]}>Patrimônio</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* MODAL DE FILTRO DE CRIMES */}
          {mapExpanded && (
              <Modal
                visible={isFilterDropdownOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={handleCloseFilterModal}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContent}>
                    {/* Header do Modal */}
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Filtrar crimes</Text>
                      <TouchableOpacity onPress={handleCloseFilterModal} style={styles.modalCloseBtn}>
                        <FontAwesome6 name="xmark" size={18} color="#666" />
                      </TouchableOpacity>
                    </View>

                    {/* Seletor de Natureza (Dropdown) */}
                    {(() => {
                      const currentNature = mapNatureOptions.find(opt => opt.id === mapFilter) || mapNatureOptions[0];
                      return (
                        <View style={styles.modalNatureSection}>
                          <Text style={styles.modalNatureSectionLabel}>Natureza</Text>
                          <TouchableOpacity
                            style={[styles.modalNatureTrigger, modalNatureDropdownOpen && styles.modalNatureTriggerOpen]}
                            onPress={() => {
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setModalNatureDropdownOpen(prev => !prev);
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={styles.modalNatureTriggerLeft}>
                              <View style={[styles.modalNatureDot, { backgroundColor: currentNature.color }]} />
                              <Text style={styles.modalNatureTriggerText}>{currentNature.label}</Text>
                            </View>
                            <FontAwesome6
                              name={modalNatureDropdownOpen ? "chevron-up" : "chevron-down"}
                              size={12}
                              color="#666"
                            />
                          </TouchableOpacity>

                          {modalNatureDropdownOpen && (
                            <View style={styles.modalNatureMenu}>
                              {mapNatureOptions.map(item => {
                                const isSelected = mapFilter === item.id;
                                return (
                                  <TouchableOpacity
                                    key={item.id}
                                    style={[styles.modalNatureMenuItem, isSelected && styles.modalNatureMenuItemActive]}
                                    onPress={() => {
                                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                      setMapFilter(item.id);
                                      setModalNatureDropdownOpen(false);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <View style={styles.modalNatureTriggerLeft}>
                                      <View style={[styles.modalNatureDot, { backgroundColor: item.color }]} />
                                      <Text style={[styles.modalNatureMenuText, isSelected && styles.modalNatureMenuTextActive]}>
                                        {item.label}
                                      </Text>
                                    </View>
                                    {isSelected && (
                                      <FontAwesome6 name="check" size={12} color="#000" />
                                    )}
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })()}

                    <Text style={styles.modalListSubtitle}>Ocorrências</Text>

                    {/* Lista de crimes */}
                    <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                      {(mapFilter === 'life' ? lifeCrimesKeys : mapFilter === 'physical' ? physicalCrimesKeys : patrimonyCrimesKeys).map(crimeKey => {
                        const isSelected = selectedSubFilters.includes(crimeKey);
                        return (
                          <TouchableOpacity
                            key={crimeKey}
                            style={styles.modalFilterItem}
                            onPress={() => {
                              if (isSelected) {
                                setSelectedSubFilters(prev => prev.filter(k => k !== crimeKey));
                              } else {
                                setSelectedSubFilters(prev => [...prev, crimeKey]);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.modalCheckbox, isSelected && styles.modalCheckboxSelected]}>
                              {isSelected && <FontAwesome6 name="check" size={12} color="#fff" />}
                            </View>
                            <Text style={styles.modalFilterItemText}>{formatCrimeName(crimeKey)}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Rodapé do Modal */}
                    <View style={styles.modalFooter}>
                      <TouchableOpacity 
                        style={styles.modalClearBtn}
                        onPress={() => setSelectedSubFilters([])}
                      >
                        <Text style={styles.modalClearBtnText}>Limpar filtros</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.modalApplyBtn}
                        onPress={handleCloseFilterModal}
                      >
                        <Text style={styles.modalApplyBtnText}>Aplicar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
          )}
        </View>
      </View>

      {/* ================= ÁREA INFERIOR DE CARDS (FOLHA RETRÁTIL) ================= */}
      <Animated.ScrollView
        style={[styles.scrollViewContainer, animatedScrollStyle]}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 14 }}
      >
        {/* SELETOR DE CATEGORIAS VIA DROPDOWN ESTILIZADO */}
        {(() => {
          const activeOption = categoryOptions.find(opt => opt.id === selectedTab) || categoryOptions[0];
          return (
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerOpen]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setDropdownOpen(prev => !prev);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownTriggerLeft}>
                  <View style={[styles.dropdownTriggerDot, { backgroundColor: activeOption.color }]} />
                  <View>
                    <Text style={styles.dropdownCategoryLabel}>Categoria exibida</Text>
                    <Text style={styles.dropdownTriggerText}>{activeOption.label}</Text>
                  </View>
                </View>
                <View style={[styles.dropdownChevronWrap, dropdownOpen && styles.dropdownChevronWrapOpen]}>
                  <FontAwesome6
                    name={dropdownOpen ? "chevron-up" : "chevron-down"}
                    size={12}
                    color="#334155"
                  />
                </View>
              </TouchableOpacity>

              {/* Menu Dropdown com opções de categorias */}
              {dropdownOpen && (
                <View style={styles.dropdownMenu}>
                  {categoryOptions.map(item => {
                    const isSelected = selectedTab === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.dropdownMenuItem, isSelected && styles.dropdownMenuItemActive]}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          handleSelectTab(item.id);
                          setDropdownOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.dropdownItemIconCircle, { backgroundColor: item.color === '#000000' ? '#18181b' : item.color }]}>
                          <FontAwesome6 name={item.icon as any} size={12} color="#fff" />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>
                            {item.label}
                          </Text>
                          <Text style={styles.dropdownItemSubtitle} numberOfLines={1}>
                            {item.subtitle}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.dropdownCheckBadge}>
                            <FontAwesome6 name="check" size={11} color="#07268a" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* ================= 1. CARD: GERAL ================= */}
        {selectedTab === 'general' && (
          <LinearGradient
            colors={['#030514', '#0a1758', '#07268a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIconBox}>
                <FontAwesome6 name="chart-pie" size={18} color="#93c5fd" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Panorama Geral</Text>
                <Text style={styles.cardHeaderSubtitle}>{cityName} • Dados SSP-SP</Text>
              </View>
            </View>

            {/* Hero Stat */}
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>Total de Ocorrências</Text>
              <Text style={styles.heroStatNumber}>{stats.total.toLocaleString('pt-BR')}</Text>
              <Text style={styles.heroStatDescription}>casos registrados na região</Text>
            </View>

            {/* Resumo das 3 Categorias */}
            <View style={styles.categoriesSummaryGrid}>
              <TouchableOpacity
                style={styles.categorySummaryItem}
                onPress={() => handleSelectTab('life')}
                activeOpacity={0.7}
              >
                <View style={[styles.legendDot, { backgroundColor: '#000', borderWidth: 1, borderColor: '#fff' }]} />
                <Text style={styles.categorySummaryName}>Vida</Text>
                <Text style={styles.categorySummaryValue}>{lifeCrimesStats.total}</Text>
                <Text style={styles.categorySummaryPct}>
                  {stats.total > 0 ? ((lifeCrimesStats.total / stats.total) * 100).toFixed(0) : 0}%
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.categorySummaryItem}
                onPress={() => handleSelectTab('physical')}
                activeOpacity={0.7}
              >
                <View style={[styles.legendDot, { backgroundColor: '#FF0000' }]} />
                <Text style={styles.categorySummaryName}>Física</Text>
                <Text style={styles.categorySummaryValue}>{physicalCrimesStats.total}</Text>
                <Text style={styles.categorySummaryPct}>
                  {stats.total > 0 ? ((physicalCrimesStats.total / stats.total) * 100).toFixed(0) : 0}%
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.categorySummaryItem}
                onPress={() => handleSelectTab('patrimony')}
                activeOpacity={0.7}
              >
                <View style={[styles.legendDot, { backgroundColor: '#9ca3af' }]} />
                <Text style={styles.categorySummaryName}>Patrimônio</Text>
                <Text style={styles.categorySummaryValue}>{patrimonyCrimesStats.total}</Text>
                <Text style={styles.categorySummaryPct}>
                  {stats.total > 0 ? ((patrimonyCrimesStats.total / stats.total) * 100).toFixed(0) : 0}%
                </Text>
              </TouchableOpacity>
            </View>

            {/* Maiores Ocorrências */}
            <Text style={styles.sectionHeading}>Maiores Incidências no Município</Text>
            {stats.top3.map((crime, index) => {
              const icon = getCrimeIcon(crime.name);
              const pct = stats.total > 0 ? ((crime.count / stats.total) * 100).toFixed(1) : '0';
              const maxCount = stats.top3[0]?.count || 1;
              return (
                <View key={index} style={styles.crimeRowCard}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankBadgeText}>{index + 1}º</Text>
                  </View>
                  <View style={[styles.crimeIconCircle, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <FontAwesome6 name={icon.icon as any} size={13} color={icon.color} />
                  </View>
                  <View style={styles.crimeRowContent}>
                    <View style={styles.crimeRowTop}>
                      <Text style={styles.crimeName} numberOfLines={1}>
                        {formatCrimeName(crime.name)}
                      </Text>
                      <Text style={styles.crimeCountValue}>
                        {crime.count} <Text style={styles.crimePctSmall}>({pct}%)</Text>
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.max((crime.count / maxCount) * 100, 3)}%`, backgroundColor: '#60a5fa' }
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}

            {stats.bottom3.length > 0 && (
              <>
                <Text style={[styles.sectionHeading, { marginTop: 18 }]}>Menores Registros</Text>
                {stats.bottom3.map((crime, index) => {
                  const icon = getCrimeIcon(crime.name);
                  return (
                    <View key={index} style={styles.crimeRowCard}>
                      <View style={[styles.crimeIconCircle, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                        <FontAwesome6 name={icon.icon as any} size={13} color={icon.color} />
                      </View>
                      <View style={styles.crimeRowContent}>
                        <View style={styles.crimeRowTop}>
                          <Text style={styles.crimeName} numberOfLines={1}>
                            {formatCrimeName(crime.name)}
                          </Text>
                          <Text style={styles.crimeCountValue}>{crime.count} casos</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {/* Gráfico Donut em Largura Total */}
            <Text style={[styles.sectionHeading, { marginTop: 22 }]}>Distribuição das Principais Naturezas</Text>
            {renderGeneralDonut()}
          </LinearGradient>
        )}

        {/* ================= 2. CARD: CONTRA A VIDA ================= */}
        {selectedTab === 'life' && (
          <View style={[styles.card, { backgroundColor: '#111315', borderWidth: 1, borderColor: '#23272f' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIconBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                <FontAwesome6 name="skull-crossbones" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Crimes contra a Vida</Text>
                <Text style={styles.cardHeaderSubtitle}>Homicídios, latrocínios e lesões com morte</Text>
              </View>
            </View>

            {/* Hero Stat */}
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>Total Registrado</Text>
              <Text style={styles.heroStatNumber}>{lifeCrimesStats.total}</Text>
              <Text style={styles.heroStatDescription}>
                {stats.total > 0 ? ((lifeCrimesStats.total / stats.total) * 100).toFixed(1) : 0}% de todos os crimes do município
              </Text>
            </View>

            {/* Proporção Visual no Município */}
            {renderVolumeComparison(
              'Contra a Vida',
              lifeCrimesStats.total,
              stats.total,
              '#ffffff'
            )}

            {/* Lista Detalhada com Ícones e Barras */}
            <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Ocorrências Detalhadas</Text>
            {renderCategoryCrimeList(lifeCrimesStats.data, lifeCrimesStats.total, '#ffffff')}

            {/* Gráfico de Distribuição Interna Full-Width */}
            <Text style={[styles.sectionHeading, { marginTop: 22 }]}>Composição da Categoria</Text>
            {renderCategoryDonut(lifeCrimesStats, [
              '#ffffff',
              '#d1d5db',
              '#9ca3af',
              '#6b7280',
              '#4b5563',
              '#374151',
            ])}
          </View>
        )}

        {/* ================= 3. CARD: INTEGRIDADE FÍSICA ================= */}
        {selectedTab === 'physical' && (
          <View style={[styles.card, { backgroundColor: '#180707', borderWidth: 1, borderColor: '#5c1010' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <FontAwesome6 name="person-falling-burst" size={18} color="#ef4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Integridade Física</Text>
                <Text style={styles.cardHeaderSubtitle}>Agressões corporais e crimes sexuais registrados</Text>
              </View>
            </View>

            {/* Hero Stat */}
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>Total Registrado</Text>
              <Text style={[styles.heroStatNumber, { color: '#f87171' }]}>{physicalCrimesStats.total}</Text>
              <Text style={styles.heroStatDescription}>
                {stats.total > 0 ? ((physicalCrimesStats.total / stats.total) * 100).toFixed(1) : 0}% de todos os crimes do município
              </Text>
            </View>

            {/* Proporção Visual no Município */}
            {renderVolumeComparison(
              'Integridade Física',
              physicalCrimesStats.total,
              stats.total,
              '#ef4444'
            )}

            {/* Lista Detalhada com Ícones e Barras */}
            <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Ocorrências Detalhadas</Text>
            {renderCategoryCrimeList(physicalCrimesStats.data, physicalCrimesStats.total, '#ef4444')}

            {/* Gráfico de Distribuição Interna Full-Width */}
            <Text style={[styles.sectionHeading, { marginTop: 22 }]}>Composição da Categoria</Text>
            {renderCategoryDonut(physicalCrimesStats, [
              '#ef4444',
              '#f87171',
              '#fca5a5',
              '#fb7185',
              '#fda4af',
            ])}
          </View>
        )}

        {/* ================= 4. CARD: PATRIMÔNIO ================= */}
        {selectedTab === 'patrimony' && (
          <View style={[styles.card, { backgroundColor: '#161922', borderWidth: 1, borderColor: '#2d3748' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIconBox, { backgroundColor: 'rgba(148, 163, 184, 0.15)' }]}>
                <FontAwesome6 name="building-shield" size={18} color="#94a3b8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>Crimes contra o Patrimônio</Text>
                <Text style={styles.cardHeaderSubtitle}>Roubos, furtos e subtração de bens e veículos</Text>
              </View>
            </View>

            {/* Hero Stat */}
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatLabel}>Total Registrado</Text>
              <Text style={[styles.heroStatNumber, { color: '#94a3b8' }]}>{patrimonyCrimesStats.total}</Text>
              <Text style={styles.heroStatDescription}>
                {stats.total > 0 ? ((patrimonyCrimesStats.total / stats.total) * 100).toFixed(1) : 0}% de todos os crimes do município
              </Text>
            </View>

            {/* Proporção Visual no Município */}
            {renderVolumeComparison(
              'Patrimônio',
              patrimonyCrimesStats.total,
              stats.total,
              '#94a3b8'
            )}

            {/* Lista Detalhada com Ícones e Barras */}
            <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Ocorrências Detalhadas</Text>
            {renderCategoryCrimeList(patrimonyCrimesStats.data, patrimonyCrimesStats.total, '#94a3b8')}

            {/* Gráfico de Distribuição Interna Full-Width */}
            <Text style={[styles.sectionHeading, { marginTop: 22 }]}>Composição da Categoria</Text>
            {renderCategoryDonut(patrimonyCrimesStats, [
              '#38bdf8',
              '#818cf8',
              '#fbbf24',
              '#f97316',
              '#a78bfa',
              '#94a3b8',
            ])}
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ================= MAP CONTROLS & LEGENDA ================= */
  mapControlsWrapper: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  fabRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginRight: 10,
  },
  locationFabText: {
    fontFamily: 'texgyB',
    fontSize: 13,
    color: '#000',
    marginLeft: 6,
  },
  legendContainer: {
    alignItems: 'stretch',
    width: 210,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 10,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    width: '100%',
  },
  toggleButtonFloating: {
    borderWidth: 0,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    width: 'auto',
  },
  toggleText: {
    color: '#000',
    fontFamily: 'texgyB',
    fontSize: 13,
  },
  legendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    opacity: 0.5,
    width: '100%',
  },
  legendButtonActive: {
    opacity: 1,
    backgroundColor: '#d5d5d5',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendDiamond: {
    width: 10,
    height: 10,
    borderRadius: 1.5,
    marginRight: 10,
    transform: [{ rotate: '45deg' }],
  },
  legendText: {
    fontFamily: 'GlacialR',
    fontSize: 14,
    color: '#666',
  },
  legendTextActive: {
    fontFamily: 'texgyB',
    color: '#000',
  },

  /* ================= SUB-FILTRO ================= */
  subFilterWrapper: {
    marginTop: 6,
    alignItems: 'center',
    width: '100%',
    zIndex: 20,
  },
  subFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  subFilterBtnActive: {
    borderColor: '#0ea5e9',
    backgroundColor: '#f0f9ff',
  },
  subFilterText: {
    fontFamily: 'texgyB',
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  subFilterTextActive: {
    color: '#0ea5e9',
  },
  filterIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0ea5e9',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'texgyB',
  },

  /* ================= MODAL FILTRO ================= */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '85%',
    maxHeight: '75%',
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: 'texgyB',
    fontSize: 18,
    color: '#000',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalNatureSection: {
    marginBottom: 12,
  },
  modalNatureSectionLabel: {
    fontFamily: 'texgyB',
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalNatureTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalNatureTriggerOpen: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderColor: '#cbd5e1',
  },
  modalNatureTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalNatureDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  modalNatureTriggerText: {
    fontFamily: 'texgyB',
    fontSize: 13,
    color: '#1e293b',
  },
  modalNatureMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  modalNatureMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  modalNatureMenuItemActive: {
    backgroundColor: '#f1f5f9',
  },
  modalNatureMenuText: {
    fontFamily: 'GlacialR',
    fontSize: 13,
    color: '#475569',
  },
  modalNatureMenuTextActive: {
    fontFamily: 'texgyB',
    color: '#000',
  },
  modalListSubtitle: {
    fontFamily: 'texgyB',
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalScrollView: {
    maxHeight: 220,
    marginBottom: 16,
  },
  modalFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCheckboxSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  modalFilterItemText: {
    fontFamily: 'texgyR',
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalClearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  modalClearBtnText: {
    fontFamily: 'texgyB',
    fontSize: 13,
    color: '#ef4444',
  },
  modalApplyBtn: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  modalApplyBtnText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#fff',
  },

  /* ================= MAP CLUSTERS & PINS ================= */
  diamondWrapper: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDiamond: {
    width: 16,
    height: 16,
    borderRadius: 2.5,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  markerRedDiamond: {
    width: 16,
    height: 16,
    borderRadius: 2.5,
    backgroundColor: '#FF0000',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  markerGrayDiamond: {
    width: 16,
    height: 16,
    borderRadius: 2.5,
    backgroundColor: '#666666',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  markerDot: {
    width: 16,
    height: 16,
    borderRadius: 2.5,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  markerRedDot: {
    width: 16,
    height: 16,
    borderRadius: 2.5,
    backgroundColor: '#FF0000',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  markerGrayDot: {
    width: 16,
    height: 16,
    borderRadius: 2.5,
    backgroundColor: '#666666',
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  clusterContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
    height: 60,
  },
  clusterHalo: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.3,
  },
  clusterCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  clusterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },

  /* ================= FOLHA RETRÁTIL (CARDS CONTAINER) ================= */
  scrollViewContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Dimensions.get('window').height * 0.6,
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
  },

  /* ================= DROPDOWN CATEGORIA ================= */
  dropdownContainer: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    zIndex: 10,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#fff',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dropdownTriggerOpen: {
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderColor: '#cbd5e1',
  },
  dropdownTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdownTriggerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  dropdownCategoryLabel: {
    fontSize: 10,
    fontFamily: 'texgyR',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownTriggerText: {
    fontSize: 15,
    fontFamily: 'texgyB',
    color: '#0f172a',
    marginTop: 1,
  },
  dropdownChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownChevronWrapOpen: {
    backgroundColor: '#e2e8f0',
  },
  dropdownMenu: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#fff',
    marginTop: -2,
    paddingVertical: 4,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginHorizontal: 6,
    marginVertical: 2,
  },
  dropdownMenuItemActive: {
    backgroundColor: '#f8fafc',
  },
  dropdownItemIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#334155',
  },
  dropdownItemTextActive: {
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  dropdownItemSubtitle: {
    fontSize: 11,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
    marginTop: 1,
  },
  dropdownCheckBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ================= ESTILOS DO CARD DEDICADO ================= */
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 20,
    padding: 18,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderTitle: {
    color: '#fff',
    fontSize: 19,
    fontFamily: 'texgyB',
  },
  cardHeaderSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'texgyR',
    marginTop: 2,
  },

  /* ================= HERO STAT ================= */
  heroStatBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  heroStatLabel: {
    fontSize: 11,
    fontFamily: 'texgyR',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroStatNumber: {
    fontSize: 34,
    fontFamily: 'texgyB',
    color: '#ffffff',
    marginVertical: 2,
  },
  heroStatDescription: {
    fontSize: 12,
    fontFamily: 'GlacialR',
    color: 'rgba(255, 255, 255, 0.8)',
  },

  sectionHeading: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#ffffff',
    marginBottom: 12,
  },

  /* ================= GRID DE CATEGORIAS (PANORAMA GERAL) ================= */
  categoriesSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 18,
  },
  categorySummaryItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  categorySummaryName: {
    fontSize: 11,
    fontFamily: 'texgyR',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    marginBottom: 2,
  },
  categorySummaryValue: {
    fontSize: 16,
    fontFamily: 'texgyB',
    color: '#fff',
  },
  categorySummaryPct: {
    fontSize: 11,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
    marginTop: 2,
  },

  /* ================= LISTAGEM TOP 3 (GERAL) ================= */
  crimeRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#60a5fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  rankBadgeText: {
    color: '#fff',
    fontFamily: 'texgyB',
    fontSize: 11,
  },
  crimeIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  crimeRowContent: {
    flex: 1,
  },
  crimeRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  crimeName: {
    fontSize: 13,
    fontFamily: 'texgyB',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  crimeCountValue: {
    fontSize: 13,
    fontFamily: 'texgyB',
    color: '#ffffff',
  },
  crimePctSmall: {
    fontSize: 11,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  /* ================= LISTAGEM DETALHADA POR CATEGORIA ================= */
  crimeListContainer: {
    gap: 8,
  },
  crimeDetailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  crimeDetailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crimeDetailName: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#ffffff',
    marginRight: 10,
  },
  crimeDetailCountBadge: {
    alignItems: 'flex-end',
    minWidth: 55,
  },
  crimeDetailCountText: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#ffffff',
  },
  crimeDetailCountPct: {
    fontSize: 11,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
  },
  crimeDetailBarTrack: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  crimeDetailBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  /* ================= BARRA DE PROPORÇÃO NO MUNICÍPIO ================= */
  comparisonContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  comparisonTitle: {
    fontSize: 13,
    fontFamily: 'texgyB',
    color: '#ffffff',
  },
  comparisonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  comparisonBadgeText: {
    fontSize: 11,
    fontFamily: 'texgyB',
  },
  comparisonTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  comparisonFill: {
    height: '100%',
    borderRadius: 4,
  },
  comparisonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonFooterText: {
    fontSize: 12,
    fontFamily: 'texgyR',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  comparisonFooterSub: {
    fontSize: 11,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
  },

  /* ================= DONUT E LEGENDA ================= */
  donutCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  donutSvgWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  donutCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterNumber: {
    fontSize: 18,
    fontFamily: 'texgyB',
    color: '#ffffff',
  },
  donutCenterLabel: {
    fontSize: 10,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  donutLegendContainer: {
    width: '100%',
    gap: 6,
  },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  donutLegendText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'texgyR',
    color: 'rgba(255, 255, 255, 0.85)',
    marginHorizontal: 8,
  },
  donutLegendCount: {
    fontSize: 12,
    fontFamily: 'texgyB',
    color: '#ffffff',
  },
  donutLegendPct: {
    fontSize: 11,
    fontFamily: 'GlacialR',
    color: '#94a3b8',
  },
});
