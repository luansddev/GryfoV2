import React, { useEffect, useRef, useState } from 'react';
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
  Keyboard,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { getCrimeIcon, formatCrimeName } from '../constants/CrimeData';
import { useVigias } from '../context/VigiasContext';
import { StatusBar } from 'expo-status-bar';

interface ReportRelatoModalProps {
  visible: boolean;
  relato: any;
  currentDeviceId: string | null;
  alreadyReported?: boolean;
  onClose: () => void;
  onReported?: () => void;
}

type MotivoId = 'falso' | 'ofensivo' | 'dados_pessoais' | 'spam' | 'local_incorreto' | 'outro';

const MOTIVOS: { id: MotivoId; label: string; description: string; icon: string }[] = [
  { id: 'falso', label: 'Informação falsa', description: 'O relato descreve algo que não aconteceu ou é enganoso.', icon: 'circle-exclamation' },
  { id: 'ofensivo', label: 'Conteúdo ofensivo', description: 'Discurso de ódio, preconceito, ameaças ou linguagem abusiva.', icon: 'face-angry' },
  { id: 'dados_pessoais', label: 'Exposição de dados pessoais', description: 'Nomes, endereços, placas ou telefones de terceiros.', icon: 'user-secret' },
  { id: 'spam', label: 'Spam ou propaganda', description: 'Conteúdo repetido, publicitário ou sem relação com segurança.', icon: 'bullhorn' },
  { id: 'local_incorreto', label: 'Local ou natureza incorretos', description: 'A ocorrência está no lugar errado ou classificada incorretamente.', icon: 'location-crosshairs' },
  { id: 'outro', label: 'Outro motivo', description: 'Descreva o problema no campo de detalhes abaixo.', icon: 'ellipsis' },
];

const MIN_DETALHES_OUTRO = 10;
const MAX_DETALHES = 300;

const formatCityForDisplay = (city: string) =>
  city.replace(/\bS\./i, 'São ').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const reportStorageKey = (relatoId: string) => `report_${relatoId}`;

export default function ReportRelatoModal(props: ReportRelatoModalProps) {
  // O Modal no Android é uma janela separada: um SafeAreaProvider próprio garante
  // que os insets (status bar / barra de navegação) sejam medidos corretamente aqui dentro.
  // O StatusBar style="dark" garante que a barra de notificações do celular fique com ícones escuros
  // visíveis sobre o fundo claro da tela.
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={() => { Keyboard.dismiss(); props.onClose(); }}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ReportRelatoContent {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ReportRelatoContent({ visible, relato, currentDeviceId, alreadyReported = false, onClose, onReported }: ReportRelatoModalProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const { addReportNotification } = useVigias();

  const [motivo, setMotivo] = useState<MotivoId | null>(null);
  const [detalhes, setDetalhes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setMotivo(null);
      setDetalhes('');
      setIsSubmitting(false);
      setSubmitted(false);
      setErrorMsg(null);
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
    }
  }, [visible]);

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

  if (!relato) return null;

  // Espaço inferior seguro: no Android garante um mínimo mesmo se o inset vier zerado
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 12);

  const iconInfo = getCrimeIcon(relato.crimeKey);
  const dateStr = relato.createdAt?.toDate
    ? new Date(relato.createdAt.toDate()).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Agora mesmo';

  const detalhesTrim = detalhes.trim();
  const precisaDetalhes = motivo === 'outro';
  const isDisabled = !motivo || isSubmitting || (precisaDetalhes && detalhesTrim.length < MIN_DETALHES_OUTRO);

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const renderCompactSummary = () => {
    const motivoObj = motivo ? MOTIVOS.find(m => m.id === motivo) : null;
    return (
      <View style={styles.compactSummary}>
        <View style={styles.compactSummaryItem}>
          <FontAwesome6 name={iconInfo.icon as any} size={11} color={iconInfo.color} />
          <Text style={styles.compactSummaryText} numberOfLines={1}>
            {formatCrimeName(relato.crimeKey)}
            {relato.cidade ? ` · ${formatCityForDisplay(relato.cidade)}` : ''}
          </Text>
        </View>
        <View style={styles.compactDivider} />
        <View style={styles.compactSummaryItem}>
          {motivoObj ? (
            <>
              <FontAwesome6 name={motivoObj.icon as any} size={11} color="#dc2626" />
              <Text style={[styles.compactSummaryText, { color: '#b91c1c' }]} numberOfLines={1}>
                {motivoObj.label}
              </Text>
            </>
          ) : (
            <Text style={[styles.compactSummaryText, { color: '#9ca3af' }]}>Sem motivo</Text>
          )}
        </View>
      </View>
    );
  };

  const handleSubmit = async () => {
    if (isDisabled || !motivo) return;
    Keyboard.dismiss();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const motivoObj = MOTIVOS.find(m => m.id === motivo);
      const motivoLabel = motivoObj?.label || motivo;

      await addDoc(collection(db, 'denuncias'), {
        relatoId: relato.id,
        relatoOwnerId: relato.ownerId || null,
        relatoTexto: relato.texto || '',
        relatoCrimeKey: relato.crimeKey || null,
        relatoCidade: relato.cidade || null,
        reporterId: auth.currentUser?.uid || currentDeviceId || null,
        motivo,
        motivoLabel,
        detalhes: detalhesTrim,
        status: 'pendente',
        createdAt: serverTimestamp(),
      });

      await AsyncStorage.setItem(reportStorageKey(relato.id), motivo);
      
      // Adiciona a confirmação da denúncia na tela de Atividade
      addReportNotification({
        relato,
        motivoLabel,
      });

      setSubmitted(true);
      onReported?.();
    } catch (error) {
      console.error('Erro ao enviar denúncia:', error);
      setErrorMsg('Não foi possível enviar a denúncia. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showDoneState = submitted || alreadyReported;

  return (
    <>
      <View style={[
        styles.container, 
        { paddingTop: insets.top },
        isKeyboardVisible && { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 10 : 10 }
      ]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBtn} 
            onPress={isKeyboardVisible ? () => Keyboard.dismiss() : handleClose} 
            activeOpacity={0.7} 
            hitSlop={8}
          >
            <FontAwesome6 name="arrow-left" size={15} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.title}>{isKeyboardVisible ? 'Detalhes' : 'Denunciar relato'}</Text>
            <Text style={styles.subtitle}>
              {isKeyboardVisible ? 'Descreva o problema com o relato' : 'Ajude a manter a comunidade confiável'}
            </Text>
          </View>
          {isKeyboardVisible && (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => Keyboard.dismiss()}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>OK</Text>
            </TouchableOpacity>
          )}
        </View>

        {showDoneState ? (
          /* ============ ESTADO: ENVIADO / JÁ DENUNCIADO ============ */
          <View style={[styles.doneWrapper, { paddingBottom: bottomInset + 24 }]}>
            <Animated.View entering={ZoomIn.duration(400).springify()} style={styles.doneIconOuter}>
              <LinearGradient colors={['#22c55e', '#15803d']} style={styles.doneIconInner}>
                <FontAwesome6 name="check" size={30} color="#fff" />
              </LinearGradient>
            </Animated.View>
            <Animated.Text entering={FadeInUp.delay(150).duration(350)} style={styles.doneTitle}>
              {submitted ? 'Denúncia enviada' : 'Você já denunciou este relato'}
            </Animated.Text>
            <Animated.Text entering={FadeInUp.delay(250).duration(350)} style={styles.doneText}>
              {submitted
                ? 'Obrigado por contribuir! Nossa equipe vai analisar o relato e tomar as medidas necessárias.'
                : 'Sua denúncia já foi registrada e está em análise pela nossa equipe.'}
            </Animated.Text>

            <Animated.View entering={FadeInUp.delay(350).duration(350)} style={{ width: '100%' }}>
              <TouchableOpacity style={styles.submitWrapper} activeOpacity={0.85} onPress={handleClose}>
                <LinearGradient colors={['#2563eb', '#1e40af']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitButton}>
                  <Text style={styles.submitText}>Voltar aos relatos</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : (
          /* ============ FORMULÁRIO ============ */
          <View style={{ flex: 1 }}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={[
                styles.scrollContent,
                isKeyboardVisible && styles.scrollContentExpanded
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEnabled={!isKeyboardVisible}
            >
              {isKeyboardVisible ? (
                renderCompactSummary()
              ) : (
                <>
                  {/* Relato denunciado */}
                  <Text style={styles.sectionTitle}>Relato denunciado</Text>
                  <Animated.View entering={FadeInDown.duration(300)} style={styles.relatoCard}>
                    <View style={styles.relatoHeader}>
                      <View style={[styles.relatoIcon, { backgroundColor: `${iconInfo.color}14`, borderColor: `${iconInfo.color}33` }]}>
                        <FontAwesome6 name={iconInfo.icon as any} size={17} color={iconInfo.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.relatoCrime, { color: iconInfo.color }]} numberOfLines={1}>
                          {formatCrimeName(relato.crimeKey)}
                        </Text>
                        <Text style={styles.relatoDate}>{dateStr}</Text>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      {!!relato.cidade && (
                        <View style={styles.metaChip}>
                          <FontAwesome6 name="location-dot" size={10} color="#64748b" />
                          <Text style={styles.metaChipText}>{formatCityForDisplay(relato.cidade)}</Text>
                        </View>
                      )}
                      {relato.isVisitor && (
                        <View style={styles.metaChip}>
                          <FontAwesome6 name="person-walking-luggage" size={10} color="#64748b" />
                          <Text style={styles.metaChipText}>Visitante</Text>
                        </View>
                      )}
                      <View style={styles.metaChip}>
                        <FontAwesome6 name={relato.latitude && relato.longitude ? 'map-location-dot' : 'eye-slash'} size={10} color="#64748b" />
                        <Text style={styles.metaChipText}>{relato.latitude && relato.longitude ? 'No mapa' : 'Sem local'}</Text>
                      </View>
                    </View>

                    <View style={styles.quoteBox}>
                      <FontAwesome6 name="quote-left" size={12} color="#cbd5e1" style={{ marginBottom: 6 }} />
                      <Text style={styles.relatoText}>{relato.texto}</Text>
                    </View>

                    <View style={styles.relatoFooter}>
                      <View style={styles.voteStat}>
                        <FontAwesome6 name="arrow-up" size={11} color="#2563eb" />
                        <Text style={[styles.voteStatText, { color: '#2563eb' }]}>{relato.upvotes || 0}</Text>
                      </View>
                      <View style={styles.voteStat}>
                        <FontAwesome6 name="arrow-down" size={11} color="#dc2626" />
                        <Text style={[styles.voteStatText, { color: '#dc2626' }]}>{relato.downvotes || 0}</Text>
                      </View>
                    </View>
                  </Animated.View>

                  {/* Motivo */}
                  <Text style={styles.sectionTitle}>Qual o problema?</Text>
                  {MOTIVOS.map((m, i) => {
                    const selected = motivo === m.id;
                    return (
                      <Animated.View key={m.id} entering={FadeInDown.delay(80 + i * 40).duration(280)}>
                        <TouchableOpacity
                          style={[styles.optionCard, selected && styles.optionCardSelected]}
                          activeOpacity={0.8}
                          onPress={() => {
                            setMotivo(m.id);
                            setErrorMsg(null);
                          }}
                        >
                          <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                            <FontAwesome6 name={m.icon as any} size={15} color={selected ? '#dc2626' : '#64748b'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.optionLabel, selected && { color: '#b91c1c' }]}>{m.label}</Text>
                            <Text style={styles.optionDesc}>{m.description}</Text>
                          </View>
                          <View style={[styles.radio, selected && styles.radioSelected]}>
                            {selected && <Animated.View entering={ZoomIn.duration(180)} style={styles.radioDot} />}
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}

                  {/* Detalhes */}
                  <Text style={styles.sectionTitle}>
                    Detalhes {precisaDetalhes ? <Text style={styles.required}>(obrigatório)</Text> : <Text style={styles.optional}>(opcional)</Text>}
                  </Text>
                </>
              )}

              {/* Detalhes Input Box */}
              <View style={[
                styles.inputBox,
                isKeyboardVisible && styles.inputBoxExpanded,
                precisaDetalhes && detalhesTrim.length < MIN_DETALHES_OUTRO && styles.inputBoxWarn
              ]}>
                <TextInput
                  ref={textInputRef}
                  style={[styles.input, isKeyboardVisible && styles.inputExpanded]}
                  placeholder="Conte o que há de errado com este relato..."
                  placeholderTextColor="#9ca3af"
                  multiline
                  maxLength={MAX_DETALHES}
                  value={detalhes}
                  onChangeText={setDetalhes}
                  textAlignVertical="top"
                />
                <View style={styles.counterRow}>
                  {precisaDetalhes && detalhesTrim.length < MIN_DETALHES_OUTRO ? (
                    <Text style={styles.counterHint}>Mínimo {MIN_DETALHES_OUTRO - detalhesTrim.length} caracteres</Text>
                  ) : <View />}
                  <Text style={styles.counter}>{detalhes.length}/{MAX_DETALHES}</Text>
                </View>
              </View>

              {!isKeyboardVisible && (
                <>
                  {/* Aviso */}
                  <View style={styles.infoBox}>
                    <FontAwesome6 name="shield-halved" size={14} color="#2563eb" />
                    <Text style={styles.infoText}>
                      Sua denúncia é confidencial. O autor do relato não saberá quem fez a denúncia.
                    </Text>
                  </View>

                  {!!errorMsg && (
                    <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
                      <FontAwesome6 name="triangle-exclamation" size={13} color="#dc2626" />
                      <Text style={styles.errorText}>{errorMsg}</Text>
                    </Animated.View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Botão enviar só aparece quando o teclado estiver fechado */}
            {!isKeyboardVisible && (
              <View style={[styles.footer, { paddingBottom: bottomInset + 12 }]}>
                <TouchableOpacity
                  style={[styles.submitWrapperRed, isDisabled && styles.submitWrapperDisabled]}
                  activeOpacity={0.85}
                  onPress={handleSubmit}
                  disabled={isDisabled}
                >
                  <LinearGradient
                    colors={isDisabled ? ['#e5e7eb', '#d1d5db'] : ['#ef4444', '#b91c1c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitButton}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={[styles.submitText, isDisabled && { color: '#9ca3af' }]}>Enviar denúncia</Text>
                        <FontAwesome6 name="paper-plane" size={15} color={isDisabled ? '#9ca3af' : '#fff'} style={{ marginLeft: 10 }} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 22,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#64748b',
    marginTop: 2,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  scrollContentExpanded: {
    flex: 1,
    paddingBottom: 0,
  },

  // Compact summary (shown when keyboard is open)
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
    gap: 8,
  },
  compactSummaryText: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#475569',
    flex: 1,
  },
  compactDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'texgyB',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
    marginLeft: 6,
  },
  required: {
    color: '#dc2626',
    textTransform: 'none',
    letterSpacing: 0,
  },
  optional: {
    textTransform: 'none',
    letterSpacing: 0,
  },

  /* Relato card */
  relatoCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  relatoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  relatoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  relatoCrime: {
    fontSize: 14,
    fontFamily: 'texgyB',
    textTransform: 'uppercase',
  },
  relatoDate: {
    fontSize: 12,
    fontFamily: 'texgyR',
    color: '#94a3b8',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 11,
    fontFamily: 'texgyB',
    color: '#475569',
  },
  quoteBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  relatoText: {
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#334155',
    lineHeight: 21,
  },
  relatoFooter: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  voteStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  voteStatText: {
    fontSize: 12,
    fontFamily: 'texgyB',
  },

  /* Options */
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  optionCardSelected: {
    borderColor: 'rgba(220, 38, 38, 0.45)',
    backgroundColor: '#fffafa',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconSelected: {
    backgroundColor: '#fee2e2',
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  optionDesc: {
    fontSize: 12,
    fontFamily: 'texgyR',
    color: '#64748b',
    marginTop: 2,
    lineHeight: 17,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  radioSelected: {
    borderColor: '#dc2626',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dc2626',
  },

  /* Input */
  inputBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    padding: 14,
    minHeight: 120,
  },
  inputBoxExpanded: {
    flex: 1,
    minHeight: undefined,
  },
  inputBoxWarn: {
    borderColor: '#fcd34d',
  },
  input: {
    flex: 1,
    minHeight: 70,
    fontFamily: 'texgyR',
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 22,
  },
  inputExpanded: {
    minHeight: undefined,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  counterHint: {
    fontFamily: 'texgyR',
    fontSize: 11,
    color: '#d97706',
  },
  counter: {
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#9ca3af',
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 12,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 17,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontFamily: 'texgyR',
    fontSize: 12,
    color: '#b91c1c',
    lineHeight: 17,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#ececec',
  },
  submitWrapperRed: {
    borderRadius: 16,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
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

  /* Done state */
  doneWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  doneIconOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  doneIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
});
