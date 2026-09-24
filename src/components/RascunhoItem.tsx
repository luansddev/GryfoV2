import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, Modal } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { db } from '../config/firebaseConfig';
import { doc, deleteDoc } from 'firebase/firestore';
import { getCrimeIcon, formatCrimeName } from '../constants/CrimeData';

interface RascunhoItemProps {
  rascunho: any;
  index?: number;
  onEdit: (rascunho: any) => void;
}

export default function RascunhoItem({ rascunho, index = 0, onEdit }: RascunhoItemProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const dateStr = rascunho.updatedAt 
    ? new Date(rascunho.updatedAt.toDate()).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Agora mesmo';

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    try {
      await deleteDoc(doc(db, 'rascunhos', rascunho.id));
    } catch (error) {
      console.error("Erro ao apagar rascunho:", error);
      Alert.alert("Erro", "Não foi possível apagar o rascunho. Verifique sua conexão.");
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
              <Text style={styles.deleteModalTitle}>Excluir Rascunho?</Text>
              <Text style={styles.deleteModalText}>Esta ação é permanente e não poderá ser desfeita.</Text>
              
              <View style={styles.deleteModalButtons}>
                <TouchableOpacity style={styles.deleteModalCancelButton} onPress={() => setShowDeleteModal(false)}>
                  <Text style={styles.deleteModalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteModalConfirmButton} onPress={confirmDelete}>
                  <Text style={styles.deleteModalConfirmText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        <View style={styles.postHeader}>
          <Text style={styles.postDate}>Salvo em {dateStr}</Text>
          <View style={styles.ownerBadge}>
            <Text style={styles.ownerBadgeText}>Rascunho</Text>
          </View>
        </View>

        {rascunho.crimeKey ? (
          <View style={[styles.crimeNatureBadge, { backgroundColor: `${getCrimeIcon(rascunho.crimeKey).color}20` }]}>
            <FontAwesome6 name={getCrimeIcon(rascunho.crimeKey).icon as any} size={12} color={getCrimeIcon(rascunho.crimeKey).color} />
            <Text style={[styles.crimeNatureText, { color: getCrimeIcon(rascunho.crimeKey).color }]}>
              {formatCrimeName(rascunho.crimeKey)}
            </Text>
          </View>
        ) : (
          <View style={[styles.crimeNatureBadge, { backgroundColor: '#f3f4f6' }]}>
            <Text style={[styles.crimeNatureText, { color: '#6b7280' }]}>NATUREZA NÃO SELECIONADA</Text>
          </View>
        )}
        
        <Text style={styles.postText}>
          {rascunho.texto || "Nenhum texto preenchido..."}
        </Text>

        <View style={styles.postFooter}>
          <TouchableOpacity 
            style={styles.editButton} 
            activeOpacity={0.7}
            onPress={() => onEdit(rascunho)}
          >
            <FontAwesome6 name="pen" size={14} color="#2563eb" />
            <Text style={styles.editButtonText}>Continuar editando</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.deleteButton} 
            activeOpacity={0.7}
            onPress={() => setShowDeleteModal(true)}
          >
            <FontAwesome6 name="trash-can" size={14} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  postCardContainer: {
    marginBottom: 16,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
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
  ownerBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4b5563',
  },
  crimeNatureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  crimeNatureText: {
    fontSize: 12,
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 8,
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
});
