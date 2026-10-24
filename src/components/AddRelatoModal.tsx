import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Keyboard,
  LayoutAnimation,
  Dimensions,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { FontAwesome6, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Svg, { Path } from 'react-native-svg';

import {
  mapNatureOptions,
  formatCrimeName,
  getCrimeIcon,
  lifeCrimesKeys,
  physicalCrimesKeys,
  patrimonyCrimesKeys,
} from '../constants/CrimeData';
import { db, auth } from '../config/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useSearchLocation } from '../context/SearchLocationContext';
import { normalizarCidade } from '../context/Normalizer';
import { getDeviceId } from '../utils/device';

export interface AddRelatoModalProps {
  visible: boolean;
  onClose: () => void;
  draftData?: {
    texto?: string;
    crimeKey?: string | null;
    horarioAproximado?: number;
    frequencia?: 'pontual' | 'recorrente';
  };
  draftId?: string;
  initialLocation?: { latitude: number; longitude: number } | null;
  initialCityName?: string | null;
  initialAddress?: string | null;
  onChangeLocation?: (
    texto: string,
    crimeKey: string | null,
    horarioAproximado?: number,
    frequencia?: 'pontual' | 'recorrente'
  ) => void;
}

// Estilo de mapa Dark minimalista (tons escuros compatíveis com o tema escuro do card)
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#14272e' }, { visibility: 'on' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0f172a' }],
  },
];

const getRelatoColor = (natureza?: string | null) => {
  if (!natureza) return '#60a5fa';
  const up = natureza.toUpperCase();
  if (lifeCrimesKeys.includes(up)) return '#ffffff';
  if (physicalCrimesKeys.includes(up)) return '#ef4444';
  if (patrimonyCrimesKeys.includes(up)) return '#94a3b8';
  return '#60a5fa';
};

const formatCityForDisplay = (city: string) => {
  return city
    .replace(/\bS\./i, 'São ')
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const getPeriodDescription = (h: number) => {
  if (h >= 0 && h <= 5) return 'Madrugada';
  if (h >= 6 && h <= 11) return 'Manhã';
  if (h === 12) return 'Meio-dia';
  if (h >= 13 && h <= 17) return 'Tarde';
  return 'Noite';
};

const MIN_CARACTERES = 80;
const MAX_CARACTERES = 600;

export default function AddRelatoModal(props: AddRelatoModalProps) {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={() => {
        Keyboard.dismiss();
        props.onClose();
      }}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AddRelatoContent {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function AddRelatoContent({
  visible,
  onClose,
  draftData,
  draftId,
  initialLocation,
  initialCityName,
  initialAddress,
  onChangeLocation,
}: AddRelatoModalProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12);

  const [text, setText] = useState(draftData?.texto || '');
  const [selectedCrime, setSelectedCrime] = useState<string | null>(draftData?.crimeKey || null);
  const [hour, setHour] = useState<number>(draftData?.horarioAproximado ?? 12);
  const [frequencia, setFrequencia] = useState<'pontual' | 'recorrente'>(draftData?.frequencia || 'pontual');

  const [isSelectingCrime, setIsSelectingCrime] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showVisitorTooltip, setShowVisitorTooltip] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const { userCity, searchMode, searchedCity } = useSearchLocation();
  const textInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const effectiveTargetCity = initialCityName || (searchMode && searchedCity ? searchedCity : null) || userCity || 'São Paulo';
  const targetCityNormalized = normalizarCidade(effectiveTargetCity);
  const userCityNormalized = normalizarCidade(userCity || 'São Paulo');
  const isVisitor = targetCityNormalized !== userCityNormalized;

  useEffect(() => {
    if (showVisitorTooltip) {
      const timer = setTimeout(() => setShowVisitorTooltip(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [showVisitorTooltip]);

  useEffect(() => {
    if (visible) {
      setText(draftData?.texto || '');
      setSelectedCrime(draftData?.crimeKey || null);
      setHour(draftData?.horarioAproximado ?? 12);
      setFrequencia(draftData?.frequencia || 'pontual');
      setIsSelectingCrime(false);
      setShowOptions(false);
      setShowVisitorTooltip(false);
      setShowConfirmModal(false);
      setIsSubmitting(false);
      setSubmitted(false);
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      setScrollEnabled(true);
    }
  }, [visible, draftData]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleClose = () => {
    Keyboard.dismiss();
    setShowOptions(false);
    setShowVisitorTooltip(false);
    setShowConfirmModal(false);
    setIsSelectingCrime(false);
    onClose();
  };

  const handleClear = () => {
    Keyboard.dismiss();
    setText('');
    setSelectedCrime(null);
    setShowOptions(false);
    setShowVisitorTooltip(false);
    setShowConfirmModal(false);
    onClose();
  };

  const handleDraft = async () => {
    if (text.length === 0 && !selectedCrime) {
      handleClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const city = targetCityNormalized;
      const ownerId = auth.currentUser?.uid || (await getDeviceId());

      if (draftId) {
        await updateDoc(doc(db, 'rascunhos', draftId), {
          cidade: city,
          crimeKey: selectedCrime,
          texto: text,
          horarioAproximado: hour,
          frequencia,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'rascunhos'), {
          cidade: city,
          ownerId,
          crimeKey: selectedCrime,
          texto: text,
          horarioAproximado: hour,
          frequencia,
          latitude: initialLocation?.latitude || null,
          longitude: initialLocation?.longitude || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      handleClear();
    } catch (error) {
      console.error('Erro ao salvar rascunho: ', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePressSubmit = () => {
    const trimmed = text.trim();
    if (!selectedCrime || trimmed.length < MIN_CARACTERES || trimmed.length > MAX_CARACTERES) {
      return;
    }
    Keyboard.dismiss();
    // Exibe o lembrete final de segurança como alert de confirmação
    setShowConfirmModal(true);
  };

  const executeSubmit = async () => {
    const trimmed = text.trim();
    setIsSubmitting(true);
    try {
      const city = targetCityNormalized;
      const ownerId = auth.currentUser?.uid || (await getDeviceId());

      await addDoc(collection(db, 'relatos'), {
        cidade: city,
        ownerId,
        crimeKey: selectedCrime,
        texto: trimmed,
        latitude: initialLocation?.latitude || null,
        longitude: initialLocation?.longitude || null,
        endereco: initialAddress || null,
        horarioAproximado: hour,
        frequencia,
        createdAt: serverTimestamp(),
        upvotes: 0,
        downvotes: 0,
        isVisitor,
      });

      if (draftId) {
        await deleteDoc(doc(db, 'rascunhos', draftId));
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Erro ao adicionar relato: ', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const trimmedLength = text.trim().length;
  const isTooShort = trimmedLength < MIN_CARACTERES;
  const isTooLong = trimmedLength > MAX_CARACTERES;
  const isDisabled = !selectedCrime || isTooShort || isTooLong || isSubmitting;

  const renderCompactSummary = () => {
    const crimeInfo = selectedCrime ? getCrimeIcon(selectedCrime) : null;
    return (
      <View style={styles.compactSummary}>
        <View style={styles.compactSummaryItem}>
          <FontAwesome6 name="location-dot" size={11} color="#64748b" />
          <Text style={styles.compactSummaryText} numberOfLines={1}>
            {formatCityForDisplay(effectiveTargetCity)}
          </Text>
        </View>
        <View style={styles.compactDivider} />
        <View style={styles.compactSummaryItem}>
          {crimeInfo ? (
            <>
              <FontAwesome6 name={crimeInfo.icon as any} size={11} color={crimeInfo.color} />
              <Text style={styles.compactSummaryText} numberOfLines={1}>
                {formatCrimeName(selectedCrime!)}
              </Text>
            </>
          ) : (
            <Text style={[styles.compactSummaryText, { color: '#9ca3af' }]}>Sem natureza</Text>
          )}
        </View>
        <View style={styles.compactDivider} />
        <View style={styles.compactSummaryItem}>
          <FontAwesome6 name="clock" size={11} color="#2563eb" />
          <Text style={styles.compactSummaryText} numberOfLines={1}>
            {String(hour).padStart(2, '0')}:00
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
        isKeyboardVisible && { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : 10 },
      ]}
    >
      {/* Header estilo tela cheia */}
      <View style={styles.header}>
        {isSelectingCrime && (
          <TouchableOpacity
            style={[styles.headerBtn, { marginRight: 12 }]}
            onPress={() => setIsSelectingCrime(false)}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <FontAwesome6 name="arrow-left" size={15} color="#0f172a" />
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {isSelectingCrime
              ? 'Natureza do Crime'
              : isKeyboardVisible
              ? 'Descrição do relato'
              : 'Novo Relato'}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {isSelectingCrime
              ? 'Selecione a categoria correspondente'
              : isKeyboardVisible
              ? 'Digite os detalhes da ocorrência'
              : 'Compartilhe uma ocorrência com a comunidade'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isKeyboardVisible ? (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => Keyboard.dismiss()}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>OK</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={isSelectingCrime ? () => setIsSelectingCrime(false) : handleClose}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <FontAwesome6 name="xmark" size={16} color="#0f172a" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ESTADO CONCLUÍDO */}
      {submitted ? (
        <View style={[styles.doneWrapper, { paddingBottom: bottomInset + 24 }]}>
          <Animated.View entering={ZoomIn.duration(400).springify()} style={styles.doneIconOuter}>
            <LinearGradient colors={['#22c55e', '#15803d']} style={styles.doneIconInner}>
              <FontAwesome6 name="check" size={32} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Animated.Text entering={FadeInUp.delay(150).duration(350)} style={styles.doneTitle}>
            Relato publicado com sucesso!
          </Animated.Text>
          <Animated.Text entering={FadeInUp.delay(250).duration(350)} style={styles.doneText}>
            Sua contribuição é essencial para manter a comunidade informada e vigilante. Obrigado pela colaboração!
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(350).duration(350)} style={{ width: '100%' }}>
            <TouchableOpacity style={styles.submitWrapper} activeOpacity={0.85} onPress={handleClose}>
              <LinearGradient
                colors={['#2563eb', '#1e40af']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitButton}
              >
                <Text style={styles.submitText}>Voltar ao mapa</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      ) : isSelectingCrime ? (
        /* SELEÇÃO DE CRIME */
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 30, paddingTop: 10 }}>
            {mapNatureOptions.map((nature) => (
              <View key={nature.id} style={styles.natureGroup}>
                <View style={styles.natureHeader}>
                  <View style={[styles.natureIconCircle, { backgroundColor: `${nature.color}15` }]}>
                    <FontAwesome6 name={nature.icon as any} size={14} color={nature.color} />
                  </View>
                  <Text style={[styles.natureTitle, { color: nature.color }]}>{nature.label}</Text>
                </View>
                {nature.keys.map((crimeKey) => {
                  const iconInfo = getCrimeIcon(crimeKey);
                  const isSelected = selectedCrime === crimeKey;
                  return (
                    <TouchableOpacity
                      key={crimeKey}
                      style={[styles.crimeItem, isSelected && styles.crimeItemSelected]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedCrime(crimeKey);
                        setIsSelectingCrime(false);
                      }}
                    >
                      <View style={[styles.crimeIconWrapper, { backgroundColor: `${iconInfo.color}15` }]}>
                        <FontAwesome6 name={iconInfo.icon as any} size={13} color={iconInfo.color} />
                      </View>
                      <Text style={[styles.crimeItemText, isSelected && styles.crimeItemTextSelected]}>
                        {formatCrimeName(crimeKey)}
                      </Text>
                      {isSelected && (
                        <FontAwesome6 name="check" size={14} color="#2563eb" style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : (
        /* FORMULÁRIO PRINCIPAL */
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              styles.scrollContent,
              isKeyboardVisible && styles.scrollContentExpanded,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={!isKeyboardVisible && scrollEnabled}
          >
            {isKeyboardVisible ? (
              renderCompactSummary()
            ) : (
              <>
                {/* 1. CARD DE LOCALIZAÇÃO AO TOPO (MODO ESCURO + MAPA ESCURO) */}
                <Text style={styles.sectionTitle}>Localização da Ocorrência</Text>
                <Animated.View entering={FadeInDown.duration(300)} style={styles.darkLocationCard}>
                  {initialLocation ? (
                    <>
                      {/* Mini mapa escuro com marcador exato sobreposto (sem delay nativo) */}
                      <View style={styles.miniMapContainerDark}>
                        <MapView
                          key={`${initialLocation.latitude.toFixed(6)},${initialLocation.longitude.toFixed(6)}`}
                          provider={PROVIDER_GOOGLE}
                          style={styles.miniMap}
                          customMapStyle={darkMapStyle}
                          initialRegion={{
                            latitude: initialLocation.latitude,
                            longitude: initialLocation.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                          }}
                          region={{
                            latitude: initialLocation.latitude,
                            longitude: initialLocation.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                          }}
                          scrollEnabled={false}
                          zoomEnabled={false}
                          rotateEnabled={false}
                          pitchEnabled={false}
                          liteMode={Platform.OS === 'android'}
                          toolbarEnabled={false}
                          pointerEvents="none"
                        />

                        {/* Balãozinho de relato sobreposto exatamente no centro do mapa (zero delay) */}
                        <View style={styles.centerMarkerOverlay} pointerEvents="none">
                          <View style={styles.markerBalloonWrapper}>
                            <Svg width={32} height={32} viewBox="-2 -2 28 28">
                              <Path
                                d="M2 4c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-6l-2 6-2-6H4c-1.1 0-2-.9-2-2V4z"
                                fill={getRelatoColor(selectedCrime)}
                                stroke="#ffffff"
                                strokeWidth={2}
                                strokeLinejoin="round"
                              />
                            </Svg>
                          </View>
                        </View>

                        {/* Botão Trocar Localização posicionado no topo esquerdo */}
                        <TouchableOpacity
                          style={styles.darkChangeLocBtnTopLeft}
                          activeOpacity={0.85}
                          onPress={() => {
                            if (onChangeLocation) {
                              onChangeLocation(text, selectedCrime, hour, frequencia);
                            }
                          }}
                        >
                          <FontAwesome6 name="location-crosshairs" size={12} color="#60a5fa" />
                          <Text style={styles.darkChangeLocBtnText}>Trocar localização</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Informações de endereço (modo escuro) */}
                      <LinearGradient
                        colors={['#0f172a', '#1e293b']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.darkLocationCardBody}
                      >
                        <View style={styles.locationRow}>
                          <View style={styles.darkLocationPinIcon}>
                            <FontAwesome6 name="location-dot" size={14} color="#60a5fa" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.darkLocationAddressText} numberOfLines={2}>
                              {initialAddress || formatCityForDisplay(effectiveTargetCity)}
                            </Text>
                            <Text style={styles.darkLocationCitySub}>
                              {formatCityForDisplay(effectiveTargetCity)}
                            </Text>
                          </View>
                        </View>

                        {/* Legenda de Visitante (modo escuro) */}
                        {isVisitor && (
                          <View style={styles.darkVisitorInlineBanner}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              style={styles.darkVisitorBadge}
                              onPress={() => setShowVisitorTooltip(!showVisitorTooltip)}
                            >
                              <View style={styles.visitorIconWrapper}>
                                <FontAwesome6 name="location-dot" size={10} color="#000" />
                                <FontAwesome6 name="xmark" size={8} color="#000" style={styles.visitorIconCross} />
                              </View>
                              <Text style={styles.darkVisitorBadgeText}>Visitante</Text>
                            </TouchableOpacity>
                            <Text style={styles.darkVisitorBannerText}>
                              Você está publicando em uma cidade diferente da sua localização física.
                            </Text>
                          </View>
                        )}
                      </LinearGradient>
                    </>
                  ) : (
                    /* Sem localização no mapa (modo escuro) */
                    <LinearGradient
                      colors={['#0f172a', '#1e293b']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.darkNoLocationCard}
                    >
                      {/* Topo: Botão no topo esquerdo */}
                      <View style={styles.darkNoLocationHeader}>
                        <TouchableOpacity
                          style={styles.darkChangeLocBtnStatic}
                          activeOpacity={0.85}
                          onPress={() => {
                            if (onChangeLocation) {
                              onChangeLocation(text, selectedCrime, hour, frequencia);
                            }
                          }}
                        >
                          <FontAwesome6 name="location-dot" size={12} color="#60a5fa" />
                          <Text style={styles.darkChangeLocBtnText}>Definir localização</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Conteúdo: Ícone + Título + Subtítulo */}
                      <View style={styles.darkNoLocationContentRow}>
                        <View style={styles.darkNoLocationIconCircle}>
                          <MaterialIcons name="location-off" size={18} color="#94a3b8" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.darkNoLocationTitle}>Relato sem local no mapa</Text>
                          <Text style={styles.darkNoLocationSub}>
                            Vinculado à cidade de{' '}
                            <Text style={{ fontFamily: 'texgyB', color: '#f8fafc' }}>
                              {formatCityForDisplay(effectiveTargetCity)}
                            </Text>
                          </Text>
                          <Text style={styles.darkNoLocationHint}>
                            Este relato não terá marcador no mapa
                          </Text>
                        </View>
                      </View>

                      {/* Legenda de Visitante se aplicável */}
                      {isVisitor && (
                        <View style={[styles.darkVisitorInlineBanner, { marginTop: 14 }]}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.darkVisitorBadge}
                            onPress={() => setShowVisitorTooltip(!showVisitorTooltip)}
                          >
                            <View style={styles.visitorIconWrapper}>
                              <FontAwesome6 name="location-dot" size={10} color="#000" />
                              <FontAwesome6 name="xmark" size={8} color="#000" style={styles.visitorIconCross} />
                            </View>
                            <Text style={styles.darkVisitorBadgeText}>Visitante</Text>
                          </TouchableOpacity>
                          <Text style={styles.darkVisitorBannerText}>
                            Você está publicando em uma cidade diferente da sua localização física.
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  )}
                </Animated.View>

                {/* 2. SELETOR DE TIPO DE CRIME */}
                <Text style={styles.sectionTitle}>Natureza do Crime</Text>
                <TouchableOpacity
                  style={styles.crimeSelector}
                  activeOpacity={0.7}
                  onPress={() => setIsSelectingCrime(true)}
                >
                  {selectedCrime ? (
                    <View style={styles.selectedCrimeContainer}>
                      <View
                        style={[
                          styles.crimeIconWrapper,
                          { backgroundColor: `${getCrimeIcon(selectedCrime).color}15` },
                        ]}
                      >
                        <FontAwesome6
                          name={getCrimeIcon(selectedCrime).icon as any}
                          size={15}
                          color={getCrimeIcon(selectedCrime).color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectedCrimeText}>{formatCrimeName(selectedCrime)}</Text>
                        <Text style={styles.selectedCrimeSub}>Toque para alterar a natureza</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <FontAwesome6 name="shield-halved" size={16} color="#94a3b8" style={{ marginRight: 10 }} />
                      <Text style={styles.crimeSelectorPlaceholder}>Toque para selecionar a natureza...</Text>
                    </View>
                  )}
                  <FontAwesome6 name="chevron-down" size={14} color="#9ca3af" />
                </TouchableOpacity>

                {/* 3. BARRA DE PUXAR: HORÁRIO APROXIMADO (COM PANRESPONDER CONFIÁVEL) */}
                <Text style={styles.sectionTitle}>Horário Aproximado</Text>
                <View style={styles.sliderCard}>
                  <View style={styles.sliderHeaderRow}>
                    <View style={styles.timeTag}>
                      <FontAwesome6 name="clock" size={13} color="#2563eb" />
                      <Text style={styles.timeTagText}>
                        Por volta das{' '}
                        <Text style={{ fontFamily: 'texgyB', color: '#1e40af' }}>
                          {String(hour).padStart(2, '0')}:00
                        </Text>
                      </Text>
                    </View>
                    <View style={styles.periodBadge}>
                      <Text style={styles.periodBadgeText}>{getPeriodDescription(hour)}</Text>
                    </View>
                  </View>

                  <Text style={styles.sliderInstruction}>
                    Arraste a barra para indicar aproximadamente a que horas o fato ocorreu.
                  </Text>

                  {/* Componente da barra gradiente de puxar */}
                  <HorarioSlider
                    hour={hour}
                    onHourChange={setHour}
                    onSlidingStart={() => setScrollEnabled(false)}
                    onSlidingEnd={() => setScrollEnabled(true)}
                  />
                </View>

                {/* 4. TOGGLE: RECORRENTE OU PONTUAL */}
                <Text style={styles.sectionTitle}>Frequência da Ocorrência</Text>
                <View style={styles.freqToggleCard}>
                  <Text style={styles.freqQuestion}>Esse tipo de ocorrência costuma se repetir no local?</Text>
                  <View style={styles.freqRow}>
                    <TouchableOpacity
                      style={[styles.freqOption, frequencia === 'pontual' && styles.freqOptionActive]}
                      onPress={() => setFrequencia('pontual')}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.freqIconCircle,
                          frequencia === 'pontual' && styles.freqIconCircleActive,
                        ]}
                      >
                        <FontAwesome6
                          name="bolt"
                          size={14}
                          color={frequencia === 'pontual' ? '#2563eb' : '#64748b'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.freqOptionTitle,
                            frequencia === 'pontual' && styles.freqOptionTitleActive,
                          ]}
                        >
                          Pontual
                        </Text>
                        <Text style={styles.freqOptionSub}>Caso isolado</Text>
                      </View>
                      {frequencia === 'pontual' && (
                        <FontAwesome6 name="circle-check" size={16} color="#2563eb" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.freqOption, frequencia === 'recorrente' && styles.freqOptionActive]}
                      onPress={() => setFrequencia('recorrente')}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.freqIconCircle,
                          frequencia === 'recorrente' && styles.freqIconCircleActive,
                        ]}
                      >
                        <FontAwesome6
                          name="arrows-rotate"
                          size={13}
                          color={frequencia === 'recorrente' ? '#2563eb' : '#64748b'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.freqOptionTitle,
                            frequencia === 'recorrente' && styles.freqOptionTitleActive,
                          ]}
                        >
                          Recorrente
                        </Text>
                        <Text style={styles.freqOptionSub}>Frequente no local</Text>
                      </View>
                      {frequencia === 'recorrente' && (
                        <FontAwesome6 name="circle-check" size={16} color="#2563eb" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 5. DESCRIÇÃO DO RELATO */}
                <Text style={styles.sectionTitle}>Descrição do Ocorrido</Text>
                <View style={styles.privacyNoticeBox}>
                  <FontAwesome6 name="user-shield" size={13} color="#0369a1" style={{ marginTop: 2 }} />
                  <Text style={styles.privacyNoticeText}>
                    Atenção à sua privacidade: Não informe dados pessoais de terceiros ou próprios (como nomes completos, placas de veículos, telefones ou endereços de residências).
                  </Text>
                </View>
              </>
            )}

            {/* Caixa de Texto do Relato */}
            <View
              style={[
                styles.textInputCard,
                isKeyboardVisible && styles.textInputCardExpanded,
                isTooShort && text.length > 0 && styles.textInputWarn,
              ]}
            >
              <TextInput
                ref={textInputRef}
                style={[styles.textInput, isKeyboardVisible && styles.textInputExpanded]}
                placeholder="Descreva de forma clara e objetiva o que aconteceu ou o que você presenciou..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={MAX_CARACTERES}
                value={text}
                onChangeText={setText}
                textAlignVertical="top"
              />
              <View style={styles.charCounterRow}>
                {trimmedLength < MIN_CARACTERES ? (
                  <Text style={styles.charHint}>
                    Mínimo {MIN_CARACTERES - trimmedLength} caracteres restantes
                  </Text>
                ) : (
                  <Text style={styles.charHintOk}>Tamanho ideal para publicação</Text>
                )}
                <Text
                  style={[
                    styles.charCounter,
                    trimmedLength >= MIN_CARACTERES && trimmedLength <= MAX_CARACTERES && { color: '#10b981' },
                    trimmedLength > MAX_CARACTERES && { color: '#dc2626' },
                  ]}
                >
                  {trimmedLength}/{MAX_CARACTERES}
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* BOTÃO PUBLICAR RELATO (rodapé fixo) */}
          {!isKeyboardVisible && (
            <View style={[styles.footer, { paddingBottom: bottomInset + 12 }]}>
              <TouchableOpacity
                style={[styles.submitWrapper, isDisabled && styles.submitWrapperDisabled]}
                activeOpacity={0.85}
                onPress={handlePressSubmit}
                disabled={isDisabled}
              >
                <LinearGradient
                  colors={isDisabled ? ['#e5e7eb', '#d1d5db'] : ['#2563eb', '#1e40af']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitButton}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={[styles.submitText, isDisabled && { color: '#9ca3af' }]}>
                        Publicar relato
                      </Text>
                      <FontAwesome6
                        name="arrow-up"
                        size={15}
                        color={isDisabled ? '#9ca3af' : '#fff'}
                        style={{ marginLeft: 10 }}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* MODAL DE CONFIRMAÇÃO (LEMBRETE DE SEGURANÇA E B.O.) */}
      <Modal visible={showConfirmModal} transparent animationType="fade" onRequestClose={() => setShowConfirmModal(false)}>
        <View style={styles.confirmModalOverlay}>
          <Animated.View entering={FadeInUp.duration(280).springify()} style={styles.confirmModalCard}>
            <View style={styles.confirmModalIconWrap}>
              <FontAwesome6 name="shield-halved" size={28} color="#2563eb" />
            </View>

            <Text style={styles.confirmModalTitle}>Lembrete de Segurança</Text>

            <Text style={styles.confirmModalText}>
              Esta publicação tem caráter informativo comunitário e <Text style={{ fontFamily: 'texgyB', color: '#1e293b' }}>não substitui o Boletim de Ocorrência (B.O.) oficial</Text>.
              {'\n\n'}
              Caso tenha sido vítima ou presenciado um crime, não deixe de registrar a ocorrência formalmente na Delegacia de Polícia ou pela Delegacia Eletrônica.
            </Text>

            <View style={styles.confirmModalBtnRow}>
              <TouchableOpacity
                style={styles.confirmModalCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmModalCancelText}>Revisar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmModalConfirmBtn}
                onPress={() => {
                  setShowConfirmModal(false);
                  executeSubmit();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmModalConfirmText}>Entendido, Publicar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

/* ========================================================================= */
/* Componente HorarioSlider (Barra de Puxar com Gradiente, Ícones e Ajuste)  */
/* ========================================================================= */
const THUMB_SIZE = 28;

function HorarioSlider({
  hour,
  onHourChange,
  onSlidingStart,
  onSlidingEnd,
}: {
  hour: number;
  onHourChange: (h: number) => void;
  onSlidingStart?: () => void;
  onSlidingEnd?: () => void;
}) {
  const trackRef = useRef<View>(null);
  const layoutInfo = useRef<{ pageX: number; width: number }>({ pageX: 0, width: 0 });

  const updateFromPageX = (pageX: number) => {
    const { pageX: startX, width } = layoutInfo.current;
    if (width <= 0) return;
    const touchX = pageX - startX;
    const ratio = Math.max(0, Math.min(1, touchX / width));
    const newHour = Math.round(ratio * 23);
    onHourChange(Math.max(0, Math.min(23, newHour)));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        onSlidingStart?.();
        trackRef.current?.measureInWindow((x, _y, width) => {
          layoutInfo.current = { pageX: x, width };
          const touchX = evt.nativeEvent.pageX - x;
          const ratio = Math.max(0, Math.min(1, touchX / width));
          const newHour = Math.round(ratio * 23);
          onHourChange(Math.max(0, Math.min(23, newHour)));
        });
      },
      onPanResponderMove: (evt) => {
        updateFromPageX(evt.nativeEvent.pageX);
      },
      onPanResponderRelease: () => {
        onSlidingEnd?.();
      },
      onPanResponderTerminate: () => {
        onSlidingEnd?.();
      },
    })
  ).current;

  // Renderização instantânea do cursor:
  // left de 0% a 100% com translateX compensando o THUMB_SIZE proporcionalmente:
  // hour = 0  -> left: 0%, translateX: 0px
  // hour = 23 -> left: 100%, translateX: -THUMB_SIZE px
  // hour = 12 -> exatamente no centro às 12h
  // Não depende de onLayout assíncrono para aparecer no frame 0.
  const thumbPercentLeft = `${((hour / 23) * 100).toFixed(4)}%` as any;
  const thumbTranslateX = -THUMB_SIZE * (hour / 23);

  return (
    <View style={styles.sliderContainer}>
      {/* Controles de ajuste rápido (-1h e +1h) e barra deslizante */}
      <View style={styles.sliderInteractiveRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          onPress={() => onHourChange(Math.max(0, hour - 1))}
        >
          <FontAwesome6 name="minus" size={11} color="#64748b" />
        </TouchableOpacity>

        {/* Área tocável com PanResponder */}
        <View
          ref={trackRef}
          style={styles.trackTouchArea}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            trackRef.current?.measureInWindow((x, _y, width) => {
              layoutInfo.current = { pageX: x, width: width || w };
            });
          }}
          {...panResponder.panHandlers}
        >
          {/* Barra Gradiente: azul claro -> amarelo -> laranja -> azul escuro */}
          <LinearGradient
            colors={['#38bdf8', '#facc15', '#f97316', '#1e3a8a']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradientBar}
            pointerEvents="none"
          />

          {/* Cursor / Marcador (Thumb) que salta de 1h em 1h (renderização instantânea sem delay) */}
          <View
            style={[
              styles.sliderThumb,
              {
                left: thumbPercentLeft,
                transform: [{ translateX: thumbTranslateX }],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.sliderThumbDot} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.stepBtn}
          activeOpacity={0.7}
          onPress={() => onHourChange(Math.min(23, hour + 1))}
        >
          <FontAwesome6 name="plus" size={11} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Ícones na parte inferior: sol nascendo (início), sol meio-dia (meio), lua (fim) */}
      <View style={styles.sliderIconsRow}>
        <View style={styles.sliderIconColLeft}>
          <FontAwesome6 name="cloud-sun" size={13} color="#0284c7" />
          <Text style={styles.sliderIconLabel}>0h</Text>
        </View>

        <View style={styles.sliderIconColCenter}>
          <FontAwesome6 name="sun" size={13} color="#d97706" />
          <Text style={styles.sliderIconLabel}>12h</Text>
        </View>

        <View style={styles.sliderIconColRight}>
          <FontAwesome6 name="moon" size={13} color="#1e3a8a" />
          <Text style={styles.sliderIconLabel}>23h</Text>
        </View>
      </View>
    </View>
  );
}

/* ========================================================================= */
/* Estilos                                                                   */
/* ========================================================================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  doneButtonText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'texgyR',
    color: '#64748b',
    marginTop: 2,
  },
  popover: {
    position: 'absolute',
    top: 48,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
    width: 155,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  popoverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  popoverDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  popoverText: {
    fontFamily: 'texgyB',
    marginLeft: 10,
    fontSize: 13,
    color: '#475569',
  },
  popoverTextRed: {
    fontFamily: 'texgyB',
    marginLeft: 10,
    fontSize: 13,
    color: '#dc2626',
  },

  /* Scroll & Sections */
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 8,
  },
  scrollContentExpanded: {
    flex: 1,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'texgyB',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* Compact Summary (teclado aberto) */
  compactSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  compactSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  compactSummaryText: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  compactDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },

  /* 1. Card de Localização no MODO ESCURO */
  darkLocationCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  miniMapContainerDark: {
    width: '100%',
    height: 140,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    position: 'relative',
  },
  miniMap: {
    ...StyleSheet.absoluteFill,
  },
  centerMarkerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  markerBalloonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -16 }],
  },
  darkLocationCardBody: {
    padding: 14,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  darkLocationPinIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(96, 165, 250, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  darkLocationAddressText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#f8fafc',
    lineHeight: 18,
  },
  darkLocationCitySub: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  darkChangeLocBtnTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  darkChangeLocBtnInlineTopLeft: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  darkChangeLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  darkChangeLocBtnText: {
    fontFamily: 'texgyB',
    fontSize: 11,
    color: '#60a5fa',
  },
  darkVisitorInlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.25)',
    gap: 8,
  },
  darkVisitorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#facc15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  darkVisitorBadgeText: {
    fontSize: 11,
    fontFamily: 'texgyB',
    color: '#000',
    marginLeft: 4,
  },
  darkVisitorBannerText: {
    flex: 1,
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#fef08a',
    lineHeight: 15,
  },
  visitorIconWrapper: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitorIconCross: {
    position: 'absolute',
    right: -2,
    bottom: -2,
  },

  /* Sem localização modo escuro */
  darkNoLocationCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  darkNoLocationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  darkChangeLocBtnStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
  },
  darkNoLocationContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  darkNoLocationIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkNoLocationTitle: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#f8fafc',
  },
  darkNoLocationSub: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  darkNoLocationHint: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
  },

  /* 2. Seletor de Crime */
  crimeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  crimeSelectorPlaceholder: {
    fontFamily: 'texgyR',
    color: '#94a3b8',
    fontSize: 14,
  },
  selectedCrimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  crimeIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedCrimeText: {
    fontFamily: 'texgyB',
    fontSize: 15,
    color: '#0f172a',
  },
  selectedCrimeSub: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },

  /* 3. Slider de Horário */
  sliderCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeTagText: {
    fontFamily: 'texgyR',
    fontSize: 14,
    color: '#334155',
  },
  periodBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  periodBadgeText: {
    fontFamily: 'texgyB',
    fontSize: 11,
    color: '#475569',
  },
  sliderInstruction: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 16,
  },
  sliderContainer: {
    marginTop: 4,
  },
  sliderInteractiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trackTouchArea: {
    flex: 1,
    height: 38,
    justifyContent: 'center',
    position: 'relative',
  },
  gradientBar: {
    height: 14,
    borderRadius: 7,
    width: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 2.5,
    borderColor: '#2563eb',
  },
  sliderThumbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  sliderIconsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 36,
  },
  sliderIconColLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sliderIconColCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sliderIconColRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sliderIconLabel: {
    fontFamily: 'texgyB',
    fontSize: 11,
    color: '#64748b',
  },

  /* 4. Toggle Frequência */
  freqToggleCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  freqQuestion: {
    fontFamily: 'texgyR',
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
  },
  freqRow: {
    flexDirection: 'row',
    gap: 12,
  },
  freqOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  freqOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  freqIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqIconCircleActive: {
    backgroundColor: '#dbeafe',
  },
  freqOptionTitle: {
    fontFamily: 'texgyB',
    fontSize: 13,
    color: '#334155',
  },
  freqOptionTitleActive: {
    color: '#1e40af',
  },
  freqOptionSub: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },

  /* 5. Descrição & Privacidade */
  privacyNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 8,
  },
  privacyNoticeText: {
    flex: 1,
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 17,
  },
  textInputCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  textInputCardExpanded: {
    flex: 1,
    minHeight: undefined,
  },
  textInputWarn: {
    borderColor: '#fcd34d',
  },
  textInput: {
    flex: 1,
    minHeight: 70,
    fontFamily: 'texgyR',
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  textInputExpanded: {
    minHeight: undefined,
  },
  charCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  charHint: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#d97706',
  },
  charHintOk: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#10b981',
  },
  charCounter: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#9ca3af',
  },

  /* Footer / Botão de Publicar */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  submitWrapper: {
    borderRadius: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitWrapperDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    fontFamily: 'texgyB',
    color: '#fff',
    fontSize: 16,
  },

  /* Seleção de Natureza */
  natureGroup: {
    marginBottom: 20,
  },
  natureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  natureIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  natureTitle: {
    fontFamily: 'texgyB',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  crimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  crimeItemSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  crimeItemText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#334155',
  },
  crimeItemTextSelected: {
    color: '#1d4ed8',
  },

  /* Concluído */
  doneWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  doneIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doneIconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: {
    fontSize: 22,
    fontFamily: 'texgyB',
    color: '#0f172a',
    textAlign: 'center',
  },
  doneText: {
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 32,
  },

  /* Modal de Confirmação (Alerta de Segurança / B.O.) */
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  confirmModalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontFamily: 'texgyB',
    fontSize: 19,
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  confirmModalText: {
    fontFamily: 'texgyR',
    fontSize: 14,
    color: '#475569',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmModalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalCancelText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#475569',
  },
  confirmModalConfirmBtn: {
    flex: 1.3,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalConfirmText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#fff',
  },
});
