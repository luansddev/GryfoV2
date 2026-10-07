import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { auth, db } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { FontAwesome6 } from '@expo/vector-icons';
import TabTransitionView from '../components/TabTransitionView';
import { useVigias } from '../context/VigiasContext';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { getDeviceId } from '../utils/device';
import { LinearGradient } from 'expo-linear-gradient';

export default function Conta() {
  const router = useRouter();
  const { vigias } = useVigias();
  
  const [relatosCount, setRelatosCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;
  const isAnonymous = !user;

  useEffect(() => {
    let isMounted = true;

    const fetchCounts = async () => {
      try {
        const deviceId = await getDeviceId();
        const currentId = user?.uid || deviceId;
        
        const q = query(collection(db, 'relatos'), where('ownerId', '==', currentId));
        const snapshot = await getCountFromServer(q);
        
        if (isMounted) {
          setRelatosCount(snapshot.data().count);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Erro ao buscar relatos:", err);
        if (isMounted) {
          setRelatosCount(0);
          setLoading(false);
        }
      }
    };

    fetchCounts();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.error("Erro ao deslogar:", error);
      Alert.alert("Erro", "Não foi possível deslogar no momento.");
    }
  };

  const renderMetricCard = (icon: string, value: number | string | null, label: string, color: string) => (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconContainer, { backgroundColor: `${color}15` }]}>
        <FontAwesome6 name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.metricInfo}>
        <Text style={styles.metricValue}>
          {value === null ? <ActivityIndicator size="small" color={color} /> : value}
        </Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
    </View>
  );

  return (
    <TabTransitionView style={styles.container}>
      {/* Header com Fundo Gradiente */}
      <View style={styles.headerBackground}>
        <LinearGradient
          colors={['#0f172a', '#1e293b']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome6 name="chevron-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Minha Conta</Text>
          <View style={{ width: 40 }} /> {/* Spacer */}
        </View>
      </View>

      <View style={styles.content}>
        {/* Card do Perfil */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
            ) : (
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.avatarPlaceholder}
              >
                <Text style={styles.avatarInitial}>
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : (isAnonymous ? 'V' : 'U')}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.onlineBadge} />
          </View>
          
          <Text style={styles.userName}>
            {user?.displayName || (isAnonymous ? 'Visitante' : 'Usuário Gardio')}
          </Text>
          <Text style={styles.userEmail}>
            {user?.email || 'Nenhum e-mail cadastrado'}
          </Text>
          
          {isAnonymous && (
            <View style={styles.guestBadge}>
              <FontAwesome6 name="circle-info" size={12} color="#fbbf24" style={{ marginRight: 6 }} />
              <Text style={styles.guestBadgeText}>Conta não registrada</Text>
            </View>
          )}
        </View>

        {/* Participação na Comunidade */}
        <Text style={styles.sectionTitle}>Participação na Comunidade</Text>
        
        <View style={styles.metricsRow}>
          {renderMetricCard("bullhorn", relatosCount, "Relatos Criados", "#3b82f6")}
          {renderMetricCard("eye", vigias.length, "Vigias Ativos", "#10b981")}
        </View>

        {/* Card Informativo */}
        <View style={styles.infoCard}>
          <FontAwesome6 name="shield-halved" size={24} color="#64748b" style={styles.infoIcon} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Comunidade Mais Segura</Text>
            <Text style={styles.infoDescription}>
              Suas contribuições ajudam outras pessoas a ficarem atentas a problemas em suas regiões. Obrigado por participar!
            </Text>
          </View>
        </View>

        <View style={styles.spacer} />

        {/* Botão de Sair */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <FontAwesome6 name="arrow-right-from-bracket" size={18} color="#ef4444" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>{isAnonymous ? 'Fazer Login' : 'Sair da conta'}</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>Versão 1.0.0</Text>
      </View>
    </TabTransitionView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f1f5f9'
  },
  headerBackground: {
    paddingTop: 50,
    paddingBottom: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { 
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginTop: -60,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10b981',
    borderWidth: 3,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  guestBadgeText: {
    color: '#d97706',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  metricIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricInfo: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  infoIcon: {
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  spacer: {
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  logoutIcon: {
    marginRight: 12,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 24,
  }
});
