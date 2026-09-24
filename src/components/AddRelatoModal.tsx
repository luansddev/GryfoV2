import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback
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
}

export default function AddRelatoModal({ visible, onClose, draftData, draftId, initialLocation }: AddRelatoModalProps) {
  const [text, setText] = useState(draftData?.texto || '');
  const [selectedCrime, setSelectedCrime] = useState<string | null>(draftData?.crimeKey || null);
  const [isSelectingCrime, setIsSelectingCrime] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { searchMode, searchedCity, userCity } = useSearchLocation();

  const isVisitor = normalizarCidade((searchMode && searchedCity) ? searchedCity : (userCity || 'São Paulo')) !== normalizarCidade(userCity || 'São Paulo');

  useEffect(() => {
    if (visible) {
      setText(draftData?.texto || '');
      setSelectedCrime(draftData?.crimeKey || null);
    }
  }, [visible, draftData]);

  const handleClose = () => {
    setShowOptions(false);
    setIsSelectingCrime(false);
    onClose();
  };

  const handleClear = () => {
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
      const rawCity = (searchMode && searchedCity) ? searchedCity : (userCity || 'São Paulo');
      const city = normalizarCidade(rawCity);
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
    if (!selectedCrime || text.length < 5) return;
    
    setIsSubmitting(true);
    try {
      const rawCity = (searchMode && searchedCity) ? searchedCity : (userCity || 'São Paulo');
      const city = normalizarCidade(rawCity);
      const ownerId = auth.currentUser?.uid || await getDeviceId();
      const isVisitor = city !== normalizarCidade(userCity || 'São Paulo');
      
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.blurContainer}>
        <TouchableWithoutFeedback onPress={() => {
          if (showOptions) setShowOptions(false);
        }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
          >
            <View style={styles.card}>
              
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Novo Relato</Text>
                
                <View style={styles.headerRight}>
                  <TouchableOpacity 
                    style={styles.closeButton} 
                    onPress={() => setShowOptions(!showOptions)}
                  >
                    <FontAwesome6 name="xmark" size={18} color="#4b5563" />
                  </TouchableOpacity>

                  {/* Popover Options */}
                  {showOptions && (
                    <View style={styles.popover}>
                      <TouchableOpacity style={styles.popoverOption} onPress={handleClear} disabled={isSubmitting}>
                        <FontAwesome6 name="trash" size={14} color="#dc2626" />
                        <Text style={styles.popoverTextRed}>Apagar</Text>
                      </TouchableOpacity>
                      <View style={styles.popoverDivider} />
                      <TouchableOpacity style={styles.popoverOption} onPress={handleDraft} disabled={isSubmitting}>
                        <FontAwesome6 name="bookmark" size={14} color="#4b5563" />
                        <Text style={styles.popoverText}>Salvar Rascunho</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {isSelectingCrime ? (
                /* Seleção de Crime (Dropdown view) */
                <View style={styles.crimeSelectionContainer}>
                  <View style={styles.selectionHeader}>
                    <TouchableOpacity onPress={() => setIsSelectingCrime(false)} style={styles.backButton}>
                      <FontAwesome6 name="arrow-left" size={16} color="#4b5563" />
                      <Text style={styles.backText}>Voltar</Text>
                    </TouchableOpacity>
                    <Text style={styles.selectionTitle}>Selecione a Natureza</Text>
                  </View>
                  <ScrollView style={styles.crimeList} showsVerticalScrollIndicator={false}>
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
                <View style={styles.formContainer}>
                  
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

                  {/* Área de Texto */}
                  <Text style={styles.label}>Relato</Text>
                  <View style={styles.textInputContainer}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Descreva o que aconteceu ou o que você presenciou..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      maxLength={300}
                      value={text}
                      onChangeText={setText}
                      textAlignVertical="top"
                    />
                    <Text style={styles.charCounter}>
                      {text.length}/300
                    </Text>
                  </View>

                  {/* Aviso de Visitante */}
                  {isVisitor && (
                    <View style={styles.visitorWarning}>
                      <FontAwesome6 name="circle-info" size={14} color="#ca8a04" />
                      <Text style={styles.visitorWarningText}>
                        Você está reportando para uma cidade diferente da sua localização atual. Seu relato receberá o selo de "Visitante".
                      </Text>
                    </View>
                  )}

                  {/* Botão Enviar */}
                  <TouchableOpacity 
                    style={styles.submitButtonWrapper}
                    activeOpacity={0.8}
                    onPress={handleSubmit}
                    disabled={!selectedCrime || text.length < 5 || isSubmitting}
                  >
                    <LinearGradient
                      colors={(!selectedCrime || text.length < 5 || isSubmitting) ? ['#d1d5db', '#9ca3af'] : ['#3b82f6', '#1d4ed8']}
                      style={styles.submitButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.submitButtonText}>{isSubmitting ? 'Publicando...' : 'Publicar Relato'}</Text>
                      {!isSubmitting && <FontAwesome6 name="paper-plane" size={14} color="#fff" style={{ marginLeft: 8 }} />}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', // Escurece o fundo já que removemos o blur
  },
  container: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    width: '100%',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
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
    marginLeft: 10,
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  popoverTextRed: {
    marginLeft: 10,
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 20,
  },
  crimeSelectorPlaceholder: {
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
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
  },
  textInputContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    height: 160,
    marginBottom: 24,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  charCounter: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
  },
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Selection View Styles
  crimeSelectionContainer: {
    height: 340,
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
    marginLeft: 6,
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  crimeList: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  crimeItemTextSelected: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
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
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#854d0e',
    lineHeight: 18,
  },
});
