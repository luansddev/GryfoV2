import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebaseConfig';
import { doc, updateDoc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getCrimeIcon, formatCrimeName } from '../constants/CrimeData';
import ReportRelatoModal, { reportStorageKey } from './ReportRelatoModal';

interface RelatoItemProps {
  relato: any;
  currentDeviceId: string | null;
  index?: number;
  showCityHeader?: boolean;
  showOwnerBadge?: boolean;
  onViewOnMap?: (relato: any) => void;
}

const getPeriodInfo = (h: number) => {
  if (h >= 0 && h <= 5) {
    return { label: 'Madrugada', icon: 'moon', color: '#6366f1' };
  }
  if (h >= 6 && h <= 11) {
    return { label: 'Manhã', icon: 'cloud-sun', color: '#0284c7' };
  }
  if (h >= 12 && h <= 17) {
    return { label: 'Tarde', icon: 'sun', color: '#d97706' };
  }
  return { label: 'Noite', icon: 'moon', color: '#6366f1' };
};

export default function RelatoItem({ relato, currentDeviceId, index = 0, showCityHeader = false, showOwnerBadge = false, onViewOnMap }: RelatoItemProps) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [bookmarked, setBookmarked] = useState(relato.bookmarkedBy?.includes(currentDeviceId) || false);
  const [flagged, setFlagged] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showFreqTooltip, setShowFreqTooltip] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Carrega se este relato já foi denunciado por este dispositivo
  useEffect(() => {
    AsyncStorage.getItem(reportStorageKey(relato.id))
      .then((value) => setFlagged(!!value))
      .catch(() => {});
  }, [relato.id]);

  useEffect(() => {
    setBookmarked(relato.bookmarkedBy?.includes(currentDeviceId) || false);
  }, [relato.bookmarkedBy, currentDeviceId]);

  const handleBookmarkToggle = async () => {
    if (isBookmarking || !currentDeviceId) return;
    setIsBookmarking(true);
    
    const newBookmarkedState = !bookmarked;
    setBookmarked(newBookmarkedState);

    try {
      await updateDoc(doc(db, 'relatos', relato.id), {
        bookmarkedBy: newBookmarkedState ? arrayUnion(currentDeviceId) : arrayRemove(currentDeviceId)
      });
    } catch (error) {
      console.error("Erro ao atualizar bookmark:", error);
      setBookmarked(!newBookmarkedState);
    } finally {
      setIsBookmarking(false);
    }
  };

  const isOwner = relato.ownerId && relato.ownerId === currentDeviceId;

  useEffect(() => {
    if (showTooltip) {
      const timer = setTimeout(() => setShowTooltip(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [showTooltip]);

  useEffect(() => {
    if (showFreqTooltip) {
      const timer = setTimeout(() => setShowFreqTooltip(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [showFreqTooltip]);

  useEffect(() => {
    const loadVote = async () => {
      try {
        const savedVote = await AsyncStorage.getItem(`vote_${relato.id}`);
        if (savedVote === 'up' || savedVote === 'down') {
          setVote(savedVote);
        }
      } catch (e) {
        console.error("Erro ao carregar voto do async storage", e);
      }
    };
    loadVote();
  }, [relato.id]);

  const handleVote = async (type: 'up' | 'down') => {
    if (isVoting) return;
    setIsVoting(true);

    try {
      const newVote = vote === type ? null : type;
      let upChange = 0;
      let downChange = 0;

      // Remove voto antigo
      if (vote === 'up') upChange -= 1;
      if (vote === 'down') downChange -= 1;

      // Adiciona novo voto
      if (newVote === 'up') upChange += 1;
      if (newVote === 'down') downChange += 1;

      const updates: any = {};
      if (upChange !== 0) updates.upvotes = increment(upChange);
      if (downChange !== 0) updates.downvotes = increment(downChange);

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'relatos', relato.id), updates);
      }

      setVote(newVote);
      if (newVote) {
        await AsyncStorage.setItem(`vote_${relato.id}`, newVote);
      } else {
        await AsyncStorage.removeItem(`vote_${relato.id}`);
      }
    } catch (error) {
      console.error("Erro ao computar voto:", error);
    } finally {
      setIsVoting(false);
    }
  };

  const iconInfo = getCrimeIcon(relato.crimeKey);
  const rawDateStr = relato.createdAt ? new Date(relato.createdAt.toDate()).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : null;
  const publishedDateText = rawDateStr ? `Feito em ${rawDateStr}` : 'Feito agora mesmo';

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    try {
      await deleteDoc(doc(db, 'relatos', relato.id));
    } catch (error) {
      console.error("Erro ao apagar relato:", error);
      Alert.alert("Erro", "Não foi possível apagar o relato. Verifique sua conexão.");
    }
  };

  return (
    <Animated.View 
      style={styles.postCardContainer}
      entering={FadeInUp.duration(400).delay(index * 50)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(300)}
    >
      <View style={styles.postCard}>
        {/* Modal de Exclusão */}
        <Modal transparent visible={showDeleteModal} animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
          <View style={styles.deleteModalOverlay}>
            <Animated.View entering={FadeInUp.duration(300).springify()} style={styles.deleteModalCard}>
              <View style={styles.deleteModalIconWrapper}>
                <FontAwesome6 name="trash-can" size={24} color="#dc2626" />
              </View>
              <Text style={styles.deleteModalTitle}>Excluir Relato?</Text>
              <Text style={styles.deleteModalText}>Esta ação é permanente e não poderá ser desfeita. Tem certeza que deseja continuar?</Text>
              
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity 
                  style={styles.deleteModalCancelButton} 
                  onPress={() => setShowDeleteModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.deleteModalConfirmButton} 
                  onPress={confirmDelete}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteModalConfirmText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Tela de Denúncia */}
        {!isOwner && (
          <ReportRelatoModal
            visible={showReportModal}
            relato={relato}
            currentDeviceId={currentDeviceId}
            alreadyReported={flagged}
            onClose={() => setShowReportModal(false)}
            onReported={() => setFlagged(true)}
          />
        )}

        {(showTooltip || showFreqTooltip) && (
          <TouchableOpacity 
            style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 40, borderRadius: 28 }]} 
            activeOpacity={1} 
            onPress={() => {
              setShowTooltip(false);
              setShowFreqTooltip(false);
            }} 
          />
        )}
        
        {/* Header do Post */}
        {showCityHeader ? (
          /* ============================================================
             LAYOUT ESPECÍFICO PARA A BIBLIOTECA (showCityHeader = true)
             As 3 legendas (Visitante, Cidade, Ver no mapa) ficam em linha no topo,
             e os textos (Feito em, Ocorreu por volta...) ficam abaixo, livres.
             ============================================================ */
          <View style={[styles.postHeaderContainerBiblioteca, showTooltip && { zIndex: 100, elevation: 10 }]}>
            {/* Linha no topo: as 3 legendas em linha */}
            <View style={[styles.bibliotecaTopBadgesRow, showTooltip && { zIndex: 100, elevation: 10 }]}>
              <View style={[styles.bibliotecaBadgesLeft, showTooltip && { zIndex: 100, elevation: 10 }]}>
                {relato.isVisitor && (
                  <View style={{ position: 'relative', zIndex: 110, elevation: 12 }}>
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      style={[styles.visitorBadge, { marginLeft: 0 }]}
                      onPress={() => setShowTooltip(!showTooltip)}
                    >
                      <View style={styles.visitorIconWrapper}>
                        <FontAwesome6 name="location-dot" size={10} color="#000" />
                        <FontAwesome6 name="xmark" size={8} color="#000" style={styles.visitorIconCross} />
                      </View>
                      <Text style={styles.visitorBadgeText}>Visitante</Text>
                    </TouchableOpacity>

                    {showTooltip && (
                      <Animated.View 
                        entering={FadeInUp.duration(200)} 
                        exiting={FadeOut.duration(200)} 
                        style={[styles.visitorTooltip, { left: 0 }]}
                      >
                        <Text style={styles.visitorTooltipText}>
                          {isOwner 
                            ? "Você publicou este relato para uma cidade onde não estava fisicamente presente no momento da criação."
                            : "Este relato foi criado por um usuário que estava fisicamente fora desta cidade no momento da publicação."}
                        </Text>
                        <View style={[styles.visitorTooltipArrow, { left: 14 }]} />
                      </Animated.View>
                    )}
                  </View>
                )}

                {relato.cidade && (
                  <View style={styles.cityHeaderInsideContainer}>
                    <FontAwesome6 name="location-dot" size={10} color="#6b7280" />
                    <Text style={styles.cityHeaderInsideText} numberOfLines={1}>{relato.cidade}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity 
                style={[
                  styles.topMapButton, 
                  !(relato.latitude && relato.longitude) && styles.topMapButtonDisabled,
                ]}
                disabled={!(relato.latitude && relato.longitude) || !onViewOnMap}
                onPress={() => onViewOnMap?.(relato)}
                activeOpacity={0.8}
              >
                <FontAwesome6 
                  name={relato.latitude && relato.longitude ? "map-location-dot" : "location-crosshairs"} 
                  size={12} 
                  color={relato.latitude && relato.longitude ? "#2563eb" : "#9ca3af"} 
                />
                <Text style={[styles.topMapButtonText, !(relato.latitude && relato.longitude) && styles.topMapButtonTextDisabled]}>
                  {relato.latitude && relato.longitude ? "Ver no mapa" : "Sem local"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Linha abaixo: Data de publicação e Horário de Ocorrência com largura livre */}
            <View style={styles.bibliotecaDatesContainer}>
              <Text style={styles.postDate}>{publishedDateText}</Text>

              {typeof relato.horarioAproximado === 'number' && (() => {
                const periodInfo = getPeriodInfo(relato.horarioAproximado);
                const prep = relato.horarioAproximado === 1 ? 'da' : 'das';
                const hourFormatted = `${String(relato.horarioAproximado).padStart(2, '0')}:00`;
                return (
                  <View style={styles.postOccurrenceRow}>
                    <Text style={styles.postOccurrenceText}>
                      {`Ocorreu por volta ${prep} ${hourFormatted} (${periodInfo.label} `}
                    </Text>
                    <FontAwesome6
                      name={periodInfo.icon as any}
                      size={11}
                      color={periodInfo.color}
                      style={{ marginRight: 2 }}
                    />
                    <Text style={styles.postOccurrenceText}>)</Text>
                  </View>
                );
              })()}
            </View>
          </View>
        ) : (
          /* ============================================================
             LAYOUT PADRÃO (FEED E DEMAIS TELAS - showCityHeader = false)
             ============================================================ */
          <View style={[styles.postHeaderContainer, showTooltip && { zIndex: 100, elevation: 10 }]}>
            <View style={[styles.postHeaderContent, showTooltip && { zIndex: 100, elevation: 10 }]}>
              {/* Coluna da esquerda: Visitante no topo esquerdo, data de publicação abaixo e horário de ocorrência */}
              <View style={[styles.postHeaderLeftCol, showTooltip && { zIndex: 100, elevation: 10 }]}>
                {/* Visitante no topo esquerdo, acima do "Feito em" */}
                {relato.isVisitor && (
                  <View style={[styles.visitorTopWrapper, { zIndex: 110, elevation: 12 }]}>
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      style={[styles.visitorBadge, { marginLeft: 0 }]}
                      onPress={() => setShowTooltip(!showTooltip)}
                    >
                      <View style={styles.visitorIconWrapper}>
                        <FontAwesome6 name="location-dot" size={10} color="#000" />
                        <FontAwesome6 name="xmark" size={8} color="#000" style={styles.visitorIconCross} />
                      </View>
                      <Text style={styles.visitorBadgeText}>Visitante</Text>
                    </TouchableOpacity>

                    {showTooltip && (
                      <Animated.View 
                        entering={FadeInUp.duration(200)} 
                        exiting={FadeOut.duration(200)} 
                        style={[styles.visitorTooltip, { left: 0, zIndex: 9999, elevation: 9999 }]}
                      >
                        <Text style={styles.visitorTooltipText}>
                          {isOwner 
                            ? "Você publicou este relato para uma cidade onde não estava fisicamente presente no momento da criação."
                            : "Este relato foi criado por um usuário que estava fisicamente fora desta cidade no momento da publicação."}
                        </Text>
                        <View style={[styles.visitorTooltipArrow, { left: 14 }]} />
                      </Animated.View>
                    )}
                  </View>
                )}

                <Text style={styles.postDate}>{publishedDateText}</Text>

                {/* Linha abaixo da data: Horário aproximado em que ocorreu ("Ocorreu por volta das [hora] ([período] [ícone])") */}
                {typeof relato.horarioAproximado === 'number' && (() => {
                  const periodInfo = getPeriodInfo(relato.horarioAproximado);
                  const prep = relato.horarioAproximado === 1 ? 'da' : 'das';
                  const hourFormatted = `${String(relato.horarioAproximado).padStart(2, '0')}:00`;
                  return (
                    <View style={styles.postOccurrenceRow}>
                      <Text style={styles.postOccurrenceText}>
                        {`Ocorreu por volta ${prep} ${hourFormatted} (${periodInfo.label} `}
                      </Text>
                      <FontAwesome6
                        name={periodInfo.icon as any}
                        size={11}
                        color={periodInfo.color}
                        style={{ marginRight: 2 }}
                      />
                      <Text style={styles.postOccurrenceText}>)</Text>
                    </View>
                  );
                })()}
              </View>

              {/* Ações da direita: Botão "Ver no mapa" */}
              <View style={styles.postHeaderRightActions}>
                <TouchableOpacity 
                  style={[
                    styles.topMapButton, 
                    !(relato.latitude && relato.longitude) && styles.topMapButtonDisabled,
                  ]}
                  disabled={!(relato.latitude && relato.longitude) || !onViewOnMap}
                  onPress={() => onViewOnMap?.(relato)}
                  activeOpacity={0.8}
                >
                  <FontAwesome6 
                    name={relato.latitude && relato.longitude ? "map-location-dot" : "location-crosshairs"} 
                    size={12} 
                    color={relato.latitude && relato.longitude ? "#2563eb" : "#9ca3af"} 
                  />
                  <Text style={[styles.topMapButtonText, !(relato.latitude && relato.longitude) && styles.topMapButtonTextDisabled]}>
                    {relato.latitude && relato.longitude ? "Ver no mapa" : "Sem local"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View style={[styles.natureAndFreqRow, { zIndex: showFreqTooltip ? 60 : 1, elevation: showFreqTooltip ? 5 : 1 }]}>
          <View style={[styles.crimeNatureBadge, { backgroundColor: `${iconInfo.color}20` }]}>
            <FontAwesome6 name={iconInfo.icon as any} size={12} color={iconInfo.color} />
            <Text style={[styles.crimeNatureText, { color: iconInfo.color }]}>
              {formatCrimeName(relato.crimeKey)}
            </Text>
          </View>

          {relato.frequencia && (
            <View style={{ position: 'relative', zIndex: showFreqTooltip ? 70 : 1, elevation: showFreqTooltip ? 6 : 1 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowFreqTooltip(!showFreqTooltip)}
                style={[
                  styles.frequenciaBadge,
                  relato.frequencia === 'recorrente'
                    ? styles.frequenciaBadgeRecorrente
                    : styles.frequenciaBadgePontual,
                ]}
              >
                <FontAwesome6
                  name={relato.frequencia === 'recorrente' ? 'arrows-rotate' : 'bolt'}
                  size={11}
                  color={relato.frequencia === 'recorrente' ? '#d97706' : '#2563eb'}
                />
                <Text
                  style={[
                    styles.frequenciaBadgeText,
                    { color: relato.frequencia === 'recorrente' ? '#b45309' : '#1d4ed8' },
                  ]}
                >
                  {relato.frequencia === 'recorrente' ? 'Recorrente' : 'Pontual'}
                </Text>
              </TouchableOpacity>

              {showFreqTooltip && (
                <Animated.View
                  entering={FadeInUp.duration(200)}
                  exiting={FadeOut.duration(200)}
                  style={styles.freqTooltip}
                >
                  <Text style={styles.freqTooltipText}>
                    {relato.frequencia === 'recorrente'
                      ? 'Indica uma ocorrência frequente, que costuma se repetir com constância neste local.'
                      : 'Indica um caso isolado, que não costuma acontecer com frequência neste local.'}
                  </Text>
                  <View style={styles.freqTooltipArrow} />
                </Animated.View>
              )}
            </View>
          )}
        </View>
        
        <Text style={styles.postText}>
          {relato.texto}
        </Text>

        {/* Divisória estilosa */}
        <View style={styles.postFooterDivider} />

        <View style={styles.postFooter}>
          {isOwner ? (
            <View style={styles.ownerFooterLeft}>
              <View style={styles.ownerBadge}>
                <Text style={styles.ownerBadgeText}>Feito por mim</Text>
              </View>

              <TouchableOpacity 
                style={styles.ownerDeleteButton} 
                activeOpacity={0.7}
                onPress={handleDelete}
              >
                <FontAwesome6 name="trash-can" size={14} color="#dc2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.voteContainer}>
                <TouchableOpacity 
                  style={[styles.voteButton, vote === 'up' && styles.voteButtonActiveUp]} 
                  activeOpacity={0.7}
                  onPress={() => handleVote('up')}
                  disabled={isVoting}
                >
                  <FontAwesome6 name="arrow-up" size={14} color={vote === 'up' ? "#2563eb" : "#6b7280"} />
                  <Text style={[styles.voteText, { color: vote === 'up' ? '#2563eb' : '#6b7280' }]}>
                    {relato.upvotes || 0}
                  </Text>
                </TouchableOpacity>
                
                <View style={styles.voteDivider} />
                
                <TouchableOpacity 
                  style={[styles.voteButton, vote === 'down' && styles.voteButtonActiveDown]} 
                  activeOpacity={0.7}
                  onPress={() => handleVote('down')}
                  disabled={isVoting}
                >
                  <FontAwesome6 name="arrow-down" size={14} color={vote === 'down' ? "#dc2626" : "#6b7280"} />
                  <Text style={[styles.voteText, { color: vote === 'down' ? '#dc2626' : '#6b7280' }]}>
                    {relato.downvotes || 0}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionContainer}>
                <TouchableOpacity 
                  style={[styles.actionButton, bookmarked && styles.actionButtonActiveBlack]} 
                  activeOpacity={0.7}
                  onPress={handleBookmarkToggle}
                  disabled={isBookmarking}
                >
                  <FontAwesome6 name="bookmark" size={14} color={bookmarked ? "#000000" : "#6b7280"} solid={bookmarked} />
                </TouchableOpacity>
                
                <View style={styles.actionDivider} />
                
                <TouchableOpacity 
                  style={[styles.actionButton, flagged && styles.actionButtonActiveRed]} 
                  activeOpacity={0.7}
                  onPress={() => setShowReportModal(true)}
                >
                  <FontAwesome6 name="flag" size={14} color={flagged ? "#dc2626" : "#6b7280"} solid={flagged} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  postCardContainer: {
    marginBottom: 16,
  },
  cityHeaderInsideContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cityHeaderInsideText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  postHeaderContainer: {
    marginBottom: 12,
  },
  postHeaderContainerBiblioteca: {
    marginBottom: 12,
  },
  bibliotecaTopBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  bibliotecaBadgesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  bibliotecaDatesContainer: {
    width: '100%',
  },
  postHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  postHeaderLeftCol: {
    flex: 1,
    marginRight: 8,
  },
  postDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  visitorTopWrapper: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 6,
    zIndex: 60,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  postDate: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
  },
  postOccurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  postOccurrenceText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  postHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  visitorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
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
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  visitorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    marginLeft: 4,
  },
  visitorTooltip: {
    position: 'absolute',
    top: 32,
    left: 8,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    width: 220,
    zIndex: 60,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  visitorTooltipText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  visitorTooltipArrow: {
    position: 'absolute',
    top: -5,
    left: 20,
    width: 12,
    height: 12,
    backgroundColor: '#1f2937',
    transform: [{ rotate: '45deg' }],
  },
  ownerBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
  },
  ownerFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ownerDeleteButton: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  deleteModalText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4b5563',
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  natureAndFreqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  crimeNatureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef9c3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  frequenciaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  frequenciaBadgeRecorrente: {
    backgroundColor: '#fef3c7',
  },
  frequenciaBadgePontual: {
    backgroundColor: '#eff6ff',
  },
  frequenciaBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  freqTooltip: {
    position: 'absolute',
    top: 32,
    left: -10,
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 12,
    width: 220,
    zIndex: 60,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  freqTooltipText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  freqTooltipArrow: {
    position: 'absolute',
    top: -5,
    left: 20,
    width: 12,
    height: 12,
    backgroundColor: '#1f2937',
    transform: [{ rotate: '45deg' }],
  },
  crimeNatureText: {
    fontSize: 12,
    color: '#ca8a04',
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
  },
  postText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  postFooterDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
    width: '100%',
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
  },
  voteButtonActiveUp: {
    backgroundColor: '#eff6ff',
  },
  voteButtonActiveDown: {
    backgroundColor: '#fef2f2',
  },
  voteText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  voteDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#d1d5db',
    marginHorizontal: 4,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  actionButtonActiveBlack: {
    backgroundColor: '#e5e7eb',
  },
  actionButtonActiveRed: {
    backgroundColor: '#fef2f2',
  },
  actionDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#d1d5db',
    marginHorizontal: 2,
  },
  topMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
  },
  topMapButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  topMapButtonText: {
    fontWeight: '700',
    color: '#2563eb',
    fontSize: 11,
    marginLeft: 6,
  },
  topMapButtonTextDisabled: {
    color: '#9ca3af',
  },
});
