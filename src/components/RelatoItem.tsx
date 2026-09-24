import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../config/firebaseConfig';
import { doc, updateDoc, increment, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getCrimeIcon, formatCrimeName } from '../constants/CrimeData';

interface RelatoItemProps {
  relato: any;
  currentDeviceId: string | null;
  index?: number;
  showCityHeader?: boolean;
  showOwnerBadge?: boolean;
  onViewOnMap?: (relato: any) => void;
}

export default function RelatoItem({ relato, currentDeviceId, index = 0, showCityHeader = false, showOwnerBadge = false, onViewOnMap }: RelatoItemProps) {
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [bookmarked, setBookmarked] = useState(relato.bookmarkedBy?.includes(currentDeviceId) || false);
  const [flagged, setFlagged] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
  const dateStr = relato.createdAt ? new Date(relato.createdAt.toDate()).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : 'Agora mesmo';

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

        {showTooltip && (
          <TouchableOpacity 
            style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 40, borderRadius: 28 }]} 
            activeOpacity={1} 
            onPress={() => setShowTooltip(false)} 
          />
        )}
        
        <View style={styles.postHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 50, flexWrap: 'wrap', flex: 1, paddingRight: 8 }}>
            <Text style={styles.postDate}>{dateStr}</Text>
            
            {isOwner && showOwnerBadge && (
              <View style={[styles.ownerBadge, { marginLeft: 8 }]}>
                <Text style={styles.ownerBadgeText}>Feito por mim</Text>
              </View>
            )}

            {relato.isVisitor && (
              <View style={{ position: 'relative' }}>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={styles.visitorBadge}
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
                    style={styles.visitorTooltip}
                  >
                    <Text style={styles.visitorTooltipText}>
                    {isOwner 
                      ? "Você publicou este relato para uma cidade onde não estava fisicamente presente no momento da criação."
                      : "Este relato foi criado por um usuário que estava fisicamente fora desta cidade no momento da publicação."}
                  </Text>
                    <View style={styles.visitorTooltipArrow} />
                  </Animated.View>
                )}
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {showCityHeader && relato.cidade && (
              <View style={styles.cityHeaderInsideContainer}>
                <FontAwesome6 name="location-dot" size={10} color="#6b7280" />
                <Text style={styles.cityHeaderInsideText}>{relato.cidade}</Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={[
                styles.topMapButton, 
                !(relato.latitude && relato.longitude) && styles.topMapButtonDisabled,
                showCityHeader && relato.cidade ? { marginLeft: 8 } : {}
              ]}
              disabled={!(relato.latitude && relato.longitude)}
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

        <View style={[styles.crimeNatureBadge, { backgroundColor: `${iconInfo.color}20` }]}>
          <FontAwesome6 name={iconInfo.icon as any} size={12} color={iconInfo.color} />
          <Text style={[styles.crimeNatureText, { color: iconInfo.color }]}>
            {formatCrimeName(relato.crimeKey)}
          </Text>
        </View>
        
        <Text style={styles.postText}>
          {relato.texto}
        </Text>

        <View style={styles.postFooter}>
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
            {isOwner ? (
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#fef2f2' }]} 
                activeOpacity={0.7}
                onPress={handleDelete}
              >
                <FontAwesome6 name="trash-can" size={14} color="#dc2626" />
              </TouchableOpacity>
            ) : (
              <>
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
                  onPress={() => setFlagged(!flagged)}
                >
                  <FontAwesome6 name="flag" size={14} color={flagged ? "#dc2626" : "#6b7280"} solid={flagged} />
                </TouchableOpacity>
              </>
            )}
          </View>
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
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postDate: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '500',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563eb',
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
  crimeNatureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef9c3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
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
    marginBottom: 20,
    letterSpacing: 0.2,
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
