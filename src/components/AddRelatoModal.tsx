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
  TouchableWithoutFeedback,
  Keyboard,
  LayoutAnimation,
  Dimensions,
  KeyboardAvoidingView
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { mapNatureOptions, formatCrimeName, getCrimeIcon } from '../constants/CrimeData';
import { db, auth } from '../config/firebaseConfig';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useSearchLocation } from '../context/SearchLocationContext';
import { normalizarCidade } from '../context/Normalizer';
import { getDeviceId } from '../utils/device';

interface AddRelatoModalProps {
  visible: boolean;
  onClose: () => void;
  draftData?: { texto: string; crimeKey: string | null };
  draftId?: string;
  initialLocation?: { latitude: number; longitude: number } | null;
  initialCityName?: string | null;
  onChangeLocation?: (texto: string, crimeKey: string | null) => void;
}

const formatCityForDisplay = (city: string) => {
  return city.replace(/\bS\./i, 'São ').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function AddRelatoModal({ visible, onClose, draftData, draftId, initialLocation, initialCityName, onChangeLocation }: AddRelatoModalProps) {
  const [text, setText] = useState(draftData?.texto || '');
  const [selectedCrime, setSelectedCrime] = useState<string | null>(draftData?.crimeKey || null);
  const [isSelectingCrime, setIsSelectingCrime] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { searchMode, searchedCity, userCity } = useSearchLocation();
  const textInputRef = useRef<TextInput>(null);

  // "isVisitor" is visual inside the modal, based on initialCityName if provided, else user location context
  const targetCityNormalized = normalizarCidade(initialCityName || userCity || 'São Paulo');
  const userCityNormalized = normalizarCidade(userCity || 'São Paulo');
  const isVisitor = targetCityNormalized !== userCityNormalized;

  useEffect(() => {
    if (visible) {
      setText(draftData?.texto || '');
      setSelectedCrime(draftData?.crimeKey || null);
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    }
  }, [visible, draftData]);

  // Keyboard listeners
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
    setIsSelectingCrime(false);
    onClose();
  };

  const handleClear = () => {
    Keyboard.dismiss();
    setText('');
    setSelectedCrime(null);
    setShowOptions(false);
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
      const ownerId = auth.currentUser?.uid || await getDeviceId();

      if (draftId) {
        await updateDoc(doc(db, 'rascunhos', draftId), {
          cidade: city,
          crimeKey: selectedCrime,
          texto: text,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'rascunhos'), {
          cidade: city,
          ownerId: ownerId,
          crimeKey: selectedCrime,
          texto: text,
          latitude: initialLocation?.latitude || null,
          longitude: initialLocation?.longitude || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      handleClear();
    } catch (error) {
      console.error("Erro ao salvar rascunho: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCrime || text.length < 70) return;
    
    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      const city = targetCityNormalized;
      const ownerId = auth.currentUser?.uid || await getDeviceId();
      
      await addDoc(collection(db, 'relatos'), {
        cidade: city,
        ownerId: ownerId,
        crimeKey: selectedCrime,
        texto: text,
        latitude: initialLocation?.latitude || null,
        longitude: initialLocation?.longitude || null,
        createdAt: serverTimestamp(),
        upvotes: 0,
        downvotes: 0,
        isVisitor: isVisitor
      });
      
      if (draftId) {
        await deleteDoc(doc(db, 'rascunhos', draftId));
      }
      
      handleClear();
    } catch (error) {
      console.error("Erro ao adicionar relato: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = !selectedCrime || text.length < 70 || isSubmitting;

  // Summary bar shown when keyboard is open (replaces the collapsed sections)
  const renderCompactSummary = () => {
    const crimeInfo = selectedCrime ? getCrimeIcon(selectedCrime) : null;
    return (
      <View style={styles.compactSummary}>
        <View style={styles.compactSummaryItem}>
          <FontAwesome6 name="location-dot" size={11} color="#64748b" />
          <Text style={styles.compactSummaryText} numberOfLines={1}>
            {initialCityName ? formatCityForDisplay(initialCityName) : (userCity ? formatCityForDisplay(userCity) : 'Sua cidade')}
          </Text>
        </View>
        <View style={styles.compactDivider} />
        <View style={styles.compactSummaryItem}>
          {crimeInfo ? (
            <>
              <FontAwesome6 name={crimeInfo.icon as any} size={11} color={crimeInfo.color} />
              <Text style={styles.compactSummaryText} numberOfLines={1}>{formatCrimeName(selectedCrime!)}</Text>
            </>
          ) : (
            <Text style={[styles.compactSummaryText, { color: '#9ca3af' }]}>Sem natureza</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={() => {
          if (showOptions) setShowOptions(false);
          Keyboard.dismiss();
        }}>
          <View style={[
            styles.overlay,
            isKeyboardVisible && { justifyContent: 'flex-start', padding: 12, paddingTop: 40, paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : 10 }
          ]}>
            <View style={[
              styles.card,
              isKeyboardVisible && { flex: 1, maxHeight: undefined, padding: 16 }
            ]}>
              
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>
                  {isKeyboardVisible ? 'Relato' : 'Novo Relato'}
                </Text>
                
                <View style={styles.headerRight}>
                  {isKeyboardVisible ? (
                    <TouchableOpacity 
                      style={styles.doneButton}
                      onPress={() => Keyboard.dismiss()}
                    >
                      <Text style={styles.doneButtonText}>OK</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      style={styles.closeButton} 
                      onPress={() => setShowOptions(!showOptions)}
                    >
                      <FontAwesome6 name="xmark" size={18} color="#4b5563" />
                    </TouchableOpacity>
                  )}

                  {/* Popover Options */}
                  {showOptions && (
                    <View style={styles.popover}>
                      <TouchableOpacity style={styles.popoverOption} onPress={handleClear} disabled={isSubmitting}>
                        <FontAwesome6 name="trash" size={14} color="#dc2626" />
                        <Text style={styles.popoverTextRed}>Apagar</Text>
                      </TouchableOpacity>
                      {text.trim().length > 0 && (
                        <>
                          <View style={styles.popoverDivider} />
                          <TouchableOpacity style={styles.popoverOption} onPress={handleDraft} disabled={isSubmitting}>
                            <FontAwesome6 name="bookmark" size={14} color="#4b5563" />
                            <Text style={styles.popoverText}>Salvar Rascunho</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {isSelectingCrime ? (
                /* Seleção de Crime */
                <View style={styles.crimeSelectionContainer}>
                  <View style={styles.selectionHeader}>
                    <TouchableOpacity onPress={() => setIsSelectingCrime(false)} style={styles.backButton}>
                      <FontAwesome6 name="arrow-left" size={16} color="#4b5563" />
                      <Text style={styles.backText}>Voltar</Text>
                    </TouchableOpacity>
                    <Text style={styles.selectionTitle}>Selecione a Natureza</Text>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {mapNatureOptions.map((nature) => (
                      <View key={nature.id} style={styles.natureGroup}>
                        <View style={styles.natureHeader}>
                          <FontAwesome6 name={nature.icon as any} size={14} color={nature.color} />
                          <Text style={[styles.natureTitle, { color: nature.color }]}>{nature.label}</Text>
                        </View>
                        {nature.keys.map((crimeKey) => {
                          const iconInfo = getCrimeIcon(crimeKey);
                          const isSelected = selectedCrime === crimeKey;
                          return (
                            <TouchableOpacity 
                              key={crimeKey}
                              style={[styles.crimeItem, isSelected && styles.crimeItemSelected]}
                              onPress={() => {
                                setSelectedCrime(crimeKey);
                                setIsSelectingCrime(false);
                              }}
                            >
                              <View style={[styles.crimeIconWrapper, { backgroundColor: `${iconInfo.color}15` }]}>
                                <FontAwesome6 name={iconInfo.icon as any} size={12} color={iconInfo.color} />
                              </View>
                              <Text style={[styles.crimeItemText, isSelected && styles.crimeItemTextSelected]}>
                                {formatCrimeName(crimeKey)}
                              </Text>
                              {isSelected && <FontAwesome6 name="check" size={14} color="#2563eb" style={{ marginLeft: 'auto' }} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : (
                /* Formulário Principal */
                <View style={[styles.formContainer, isKeyboardVisible && { flex: 1 }]}>
                  
                  {/* When keyboard is visible: show compact summary instead of full sections */}
                  {isKeyboardVisible ? (
                    renderCompactSummary()
                  ) : (
                    <>
                      {/* Localização Info */}
                      <LinearGradient 
                        colors={initialLocation ? ['#0f172a', '#1e293b'] : ['#f1f5f9', '#e2e8f0']} 
                        start={{ x: 0, y: 0 }} 
                        end={{ x: 1, y: 1 }} 
                        style={styles.locationContainer}
                      >
                        <View style={styles.locationInfo}>
                          <View style={[styles.locationIconBg, !initialLocation && { backgroundColor: 'rgba(100, 116, 139, 0.15)' }]}>
                            <FontAwesome6 name={initialLocation ? "location-dot" : "eye-slash"} size={14} color={initialLocation ? "#60a5fa" : "#64748b"} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                            <Text style={[styles.locationText, !initialLocation && { color: '#334155' }, { marginLeft: 0, marginRight: 0 }]} numberOfLines={1}>
                              {initialCityName ? formatCityForDisplay(initialCityName) : (userCity ? formatCityForDisplay(userCity) : 'Sua cidade')}
                            </Text>
                            {!initialLocation && (
                              <Text style={{ fontFamily: 'texgyR', fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                Não será exibido no mapa
                              </Text>
                            )}
                          </View>
                          {isVisitor && initialLocation && (
                            <View style={styles.visitorBadge}>
                              <Text style={styles.visitorText}>Visitante</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity 
                          style={[styles.changeLocationBtn, !initialLocation && { backgroundColor: '#cbd5e1' }]}
                          activeOpacity={0.8}
                          onPress={() => {
                            if (onChangeLocation) {
                              onChangeLocation(text, selectedCrime);
                            }
                          }}
                        >
                          <FontAwesome6 name="map" size={12} color={initialLocation ? "#1e293b" : "#334155"} />
                          <Text style={[styles.changeLocationText, !initialLocation && { color: '#334155' }]}>Alterar</Text>
                        </TouchableOpacity>
                      </LinearGradient>

                      {/* Selector de Crime */}
                      <Text style={styles.label}>Natureza do Crime</Text>
                      <TouchableOpacity 
                        style={styles.crimeSelector} 
                        activeOpacity={0.7}
                        onPress={() => setIsSelectingCrime(true)}
                      >
                        {selectedCrime ? (
                          <View style={styles.selectedCrimeContainer}>
                            <View style={[styles.crimeIconWrapper, { backgroundColor: `${getCrimeIcon(selectedCrime).color}15` }]}>
                              <FontAwesome6 name={getCrimeIcon(selectedCrime).icon as any} size={14} color={getCrimeIcon(selectedCrime).color} />
                            </View>
                            <Text style={styles.selectedCrimeText}>{formatCrimeName(selectedCrime)}</Text>
                          </View>
                        ) : (
                          <Text style={styles.crimeSelectorPlaceholder}>Toque para selecionar...</Text>
                        )}
                        <FontAwesome6 name="chevron-down" size={14} color="#9ca3af" />
                      </TouchableOpacity>

                      {/* Label do Relato */}
                      <Text style={styles.label}>Relato</Text>
                    </>
                  )}

                  {/* Área de Texto — always visible, expands when keyboard is open */}
                  <View style={[
                    styles.textInputContainer,
                    isKeyboardVisible && styles.textInputExpanded
                  ]}>
                    <TextInput
                      ref={textInputRef}
                      style={styles.textInput}
                      placeholder="Descreva o que aconteceu ou o que você presenciou..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      maxLength={300}
                      value={text}
                      onChangeText={setText}
                      textAlignVertical="top"
                    />
                    <View style={styles.charCounterRow}>
                      {text.length < 70 && (
                        <Text style={styles.charHint}>
                          Mínimo {70 - text.length} caracteres
                        </Text>
                      )}
                      <Text style={[
                        styles.charCounter,
                        text.length >= 70 && { color: '#10b981' }
                      ]}>
                        {text.length}/300
                      </Text>
                    </View>
                  </View>

                  {/* Aviso de Visitante — only when keyboard is hidden */}
                  {!isKeyboardVisible && isVisitor && (
                    <View style={styles.visitorWarning}>
                      <FontAwesome6 name="circle-info" size={14} color="#ca8a04" />
                      <Text style={styles.visitorWarningText}>
                        Você está reportando para uma cidade diferente da sua localização atual. Seu relato receberá o selo de "Visitante".
                      </Text>
                    </View>
                  )}

                  {/* Botão Enviar — only when keyboard is hidden */}
                  {!isKeyboardVisible && (
                    <TouchableOpacity 
                      style={[styles.submitButtonWrapper, isDisabled && styles.submitButtonWrapperDisabled]}
                      activeOpacity={0.8}
                      onPress={handleSubmit}
                      disabled={isDisabled}
                    >
                      <LinearGradient
                        colors={isDisabled ? ['#e5e7eb', '#d1d5db'] : ['#2563eb', '#1e40af']}
                        style={styles.submitButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Text style={[styles.submitButtonText, isDisabled && { color: '#9ca3af' }]}>
                          {isSubmitting ? 'Publicando...' : 'Publicar Relato'}
                        </Text>
                        {!isSubmitting && (
                          <FontAwesome6 
                            name="comment-dots" 
                            size={16} 
                            color={isDisabled ? '#9ca3af' : '#fff'} 
                            style={{ marginLeft: 10 }} 
                          />
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              )}

            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 500,
    maxHeight: SCREEN_HEIGHT * 0.85,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  cardExpanded: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    zIndex: 10,
  },
  title: {
    fontFamily: 'texgyB',
    fontSize: 20,
    color: '#1f2937',
  },
  headerRight: {
    position: 'relative',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
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
  popover: {
    position: 'absolute',
    top: 44,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 20,
  },
  popoverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  popoverDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  popoverText: {
    fontFamily: 'texgyB',
    marginLeft: 10,
    fontSize: 14,
    color: '#4b5563',
  },
  popoverTextRed: {
    fontFamily: 'texgyB',
    marginLeft: 10,
    fontSize: 14,
    color: '#dc2626',
  },

  // Compact summary (shown when keyboard is open)
  compactSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    marginHorizontal: 10,
  },

  // Form
  formContainer: {
    // flex: 1 removed so it takes natural height
  },
  label: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
    marginTop: 4,
  },
  crimeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  crimeSelectorPlaceholder: {
    fontFamily: 'texgyR',
    color: '#9ca3af',
    fontSize: 15,
  },
  selectedCrimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crimeIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  selectedCrimeText: {
    fontFamily: 'texgyB',
    fontSize: 15,
    color: '#1f2937',
  },

  // Text input
  textInputContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
    flexShrink: 1,
    marginBottom: 16,
  },
  textInputExpanded: {
    flex: 1,
    height: undefined,
    marginBottom: 0,
  },
  textInput: {
    flex: 1,
    fontFamily: 'texgyR',
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  charCounterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  charHint: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#d97706',
  },
  charCounter: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 'auto',
  },

  // Submit
  submitButtonWrapper: {
    borderRadius: 16,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    fontFamily: 'texgyB',
    color: '#fff',
    fontSize: 16,
  },
  submitButtonWrapperDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // Crime Selection
  crimeSelectionContainer: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginRight: 12,
  },
  backText: {
    fontFamily: 'texgyB',
    marginLeft: 6,
    fontSize: 14,
    color: '#4b5563',
  },
  selectionTitle: {
    fontFamily: 'texgyB',
    fontSize: 16,
    color: '#1f2937',
  },
  natureGroup: {
    marginBottom: 20,
  },
  natureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  natureTitle: {
    fontFamily: 'texgyB',
    fontSize: 14,
    marginLeft: 8,
    textTransform: 'uppercase',
  },
  crimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  crimeItemSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  crimeItemText: {
    fontFamily: 'texgyB',
    fontSize: 14,
    color: '#374151',
  },
  crimeItemTextSelected: {
    color: '#1d4ed8',
  },

  // Visitor
  visitorWarning: {
    flexDirection: 'row',
    backgroundColor: '#fefce8',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  visitorWarningText: {
    fontFamily: 'texgyR',
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#854d0e',
    lineHeight: 18,
  },

  // Location
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    fontFamily: 'texgyB',
    color: '#f8fafc',
    fontSize: 15,
    marginLeft: 10,
    marginRight: 8,
    flexShrink: 1,
  },
  visitorBadge: {
    backgroundColor: 'rgba(253, 230, 138, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(252, 211, 77, 0.3)',
  },
  visitorText: {
    fontFamily: 'texgyB',
    color: '#fcd34d',
    fontSize: 10,
  },
  changeLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  changeLocationText: {
    fontFamily: 'texgyB',
    color: '#0f172a',
    fontSize: 12,
    marginLeft: 6,
  },
});
