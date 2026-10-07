import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    TouchableOpacity, 
    Alert, 
    Image, 
    ActivityIndicator, 
    ImageBackground, 
    Animated, 
    Dimensions, 
    ScrollView,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { auth, db } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { FontAwesome6 } from '@expo/vector-icons';
import { useVigias } from '../context/VigiasContext';
import { collection, query, where, getCountFromServer, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { getDeviceId } from '../utils/device';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

export default function Conta() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { vigias } = useVigias();
  
  const [relatosCount, setRelatosCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{name?: string, cpf?: string, email?: string} | null>(null);
  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const user = auth.currentUser;

  const handleSaveName = async () => {
    if (!newName.trim()) {
      Alert.alert("Erro", "O nome não pode ficar vazio.");
      return;
    }
    setIsSavingName(true);
    try {
      if (user?.uid) {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { name: newName.trim() }, { merge: true });
        setUserData(prev => prev ? { ...prev, name: newName.trim() } : { name: newName.trim() });
      }
      setIsEditNameModalVisible(false);
    } catch (error) {
      console.error("Erro ao atualizar nome:", error);
      Alert.alert("Erro", "Não foi possível atualizar o nome.");
    } finally {
      setIsSavingName(false);
    }
  };
  const isAnonymous = !user;

  const bgOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;

  useFocusEffect(
    useCallback(() => {
        bgOpacity.setValue(0);
        contentOpacity.setValue(0);
        contentTranslateY.setValue(30);

        Animated.sequence([
            Animated.timing(bgOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.parallel([
                Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.spring(contentTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
            ]),
        ]).start();
    }, [])
  );

  useEffect(() => {
    let isMounted = true;

    const fetchUserDataAndCounts = async () => {
      try {
        const deviceId = await getDeviceId();
        const currentId = user?.uid || deviceId;
        
        // Count Relatos
        const q = query(collection(db, 'relatos'), where('ownerId', '==', currentId));
        const snapshot = await getCountFromServer(q);
        
        // Fetch User Data from Firestore if not anonymous
        if (!isAnonymous && user?.uid) {
           const userDocRef = doc(db, 'users', user.uid);
           const userDocSnap = await getDoc(userDocRef);
           if (userDocSnap.exists() && isMounted) {
               setUserData(userDocSnap.data() as any);
           }
        }

        if (isMounted) {
          setRelatosCount(snapshot.data().count);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Erro ao buscar dados:", err);
        if (isMounted) {
          setRelatosCount(0);
          setLoading(false);
        }
      }
    };

    fetchUserDataAndCounts();

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

  return (
    <View style={styles.container}>
      <AnimatedImageBackground
        source={require('../../assets/images/bg_04.jpg')}
        style={[styles.background, { opacity: bgOpacity }]}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)', '#000']}
          locations={[0, 0.4, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
        
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Logo */}
          <View style={styles.topBar}>
            <Image 
              source={require('../../assets/images/gryfob.png')} 
              style={styles.logoImageSmall} 
              resizeMode="contain" 
            />
          </View>

          <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }], flex: 1 }}>
            
            {/* Profile Section */}
            <View style={styles.profileSection}>
              <Text style={styles.userName}>
                {isAnonymous ? 'Olá, Visitante' : `Olá, ${userData?.name || user?.displayName || 'Usuário Gardio'}`}
              </Text>

              {isAnonymous && (
                <View style={styles.guestBadge}>
                  <FontAwesome6 name="circle-info" size={12} color="#fbbf24" style={{ marginRight: 6 }} />
                  <Text style={styles.guestBadgeText}>Conta não registrada</Text>
                </View>
              )}
            </View>

            {/* Dados Pessoais */}
            {!isAnonymous && (
              <View style={styles.sectionContainer}>
                 <Text style={styles.sectionTitle}>Dados Pessoais</Text>
                 <Text style={styles.sectionSubtitle}>Nenhum dado é exibido para outros usuários no app.</Text>
                 
                 <View style={styles.infoField}>
                    <FontAwesome6 name="user" size={16} color="rgba(255,255,255,0.5)" style={styles.fieldIcon} />
                    <View style={{ flex: 1 }}>
                       <Text style={styles.fieldLabel}>Nome</Text>
                       <Text style={styles.fieldValue}>{userData?.name || user?.displayName || 'Não informado'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setNewName(userData?.name || user?.displayName || ''); setIsEditNameModalVisible(true); }} style={styles.editIconContainer}>
                      <FontAwesome6 name="pen" size={14} color="rgba(255,255,255,0.6)" />
                    </TouchableOpacity>
                 </View>
                 
                 <View style={styles.infoField}>
                    <FontAwesome6 name="envelope" size={16} color="rgba(255,255,255,0.5)" style={styles.fieldIcon} />
                    <View>
                       <Text style={styles.fieldLabel}>E-mail</Text>
                       <Text style={styles.fieldValue}>{userData?.email || user?.email || 'Não informado'}</Text>
                    </View>
                 </View>

                 <View style={styles.infoField}>
                    <FontAwesome6 name="id-card" size={16} color="rgba(255,255,255,0.5)" style={styles.fieldIcon} />
                    <View>
                       <Text style={styles.fieldLabel}>CPF</Text>
                       <Text style={styles.fieldValue}>{userData?.cpf || 'Não informado'}</Text>
                    </View>
                 </View>
              </View>
            )}

            {/* Metrics Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Participação na Comunidade</Text>
              <View style={styles.metricsRow}>
                <TouchableOpacity style={styles.metricCard} onPress={() => router.push('/biblioteca')} activeOpacity={0.7}>
                  <View style={styles.metricIconContainer}>
                    <FontAwesome6 name="comment-dots" size={18} color="#3b82f6" />
                  </View>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricValue}>
                      {relatosCount === null ? <ActivityIndicator size="small" color="#fff" /> : relatosCount}
                    </Text>
                    <Text style={styles.metricLabel}>Relatos Criados</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.metricCard} onPress={() => router.push('/home?switchTab=locais&openListing=true')} activeOpacity={0.7}>
                  <View style={styles.metricIconContainer}>
                    <FontAwesome6 name="eye" size={18} color="#10b981" />
                  </View>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricValue}>{vigias.length}</Text>
                    <Text style={styles.metricLabel}>Vigias Ativos</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Info Card */}
            <View style={styles.infoCard}>
              <FontAwesome6 name="shield-halved" size={24} color="rgba(255,255,255,0.7)" style={styles.infoIcon} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Comunidade Mais Segura</Text>
                <Text style={styles.infoDescription}>
                  Suas contribuições ajudam outras pessoas a ficarem atentas a problemas em suas regiões. Obrigado por participar!
                </Text>
              </View>
            </View>

            <View style={styles.spacer} />

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
              <FontAwesome6 name="arrow-right-from-bracket" size={16} color="#ef4444" style={styles.logoutIcon} />
              <Text style={styles.logoutText}>{isAnonymous ? 'Fazer Login' : 'Sair da conta'}</Text>
            </TouchableOpacity>
            
            <Text style={styles.versionText}>Versão 1.0.0</Text>
          </Animated.View>
        </ScrollView>
      </AnimatedImageBackground>

      <Modal
        visible={isEditNameModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditNameModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Nome</Text>
            <Text style={styles.modalDescription}>
              Digite seu novo nome. Lembrando que nenhum dado seu é exibido para outros usuários no aplicativo.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Seu nome"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsEditNameModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveName} disabled={isSavingName}>
                {isSavingName ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0a'
  },
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },
  topBar: {
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 40,
    justifyContent: 'center',
  },
  logoImageSmall: {
    width: 48,
    height: 48,
  },

  profileSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userName: {
    fontSize: 24,
    fontFamily: 'texgyB',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    marginTop: 8,
  },
  guestBadgeText: {
    color: '#fbbf24',
    fontSize: 13,
    fontFamily: 'texgyB',
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'texgyR',
    color: '#fff',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: 'GlacialR',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 16,
    marginTop: -8,
  },
  infoField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  fieldIcon: {
    width: 24,
    marginRight: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'GlacialR',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 16,
    fontFamily: 'texgyR',
    color: '#fff',
  },
  editIconContainer: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'texgyB',
    color: '#fff',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'GlacialR',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'texgyR',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  modalCancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'texgyB',
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    color: '#fff',
    fontFamily: 'texgyB',
    fontSize: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  metricIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricInfo: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontFamily: 'texgyB',
    color: '#fff',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: 'GlacialR',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 30,
  },
  infoIcon: {
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'texgyB',
    color: '#fff',
    marginBottom: 6,
  },
  infoDescription: {
    fontSize: 14,
    fontFamily: 'GlacialR',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 20,
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    height: 52,
    borderRadius: 14,
    marginBottom: 16,
  },
  logoutIcon: {
    marginRight: 10,
  },
  logoutText: {
    color: '#ef4444',
    fontFamily: 'texgyR',
    fontSize: 16,
  },
  versionText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'GlacialR',
    fontSize: 13,
  }
});
