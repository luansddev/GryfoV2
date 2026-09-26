import { useState } from 'react';
import { Dimensions, StyleSheet, Text, View, TouchableOpacity, LayoutAnimation, Platform } from 'react-native';
import { TabView, SceneMap } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { db, auth } from '../config/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getDeviceId } from '../utils/device';
import RelatoItem from '../components/RelatoItem';
import RascunhoItem from '../components/RascunhoItem';
import AddRelatoModal from '../components/AddRelatoModal';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const initialLayout = { width: Dimensions.get('window').width };

function Spacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: "#f5f5f5" }}></View>
}

const MeusRelatos = () => {
  const router = useRouter();
  const [relatos, setRelatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let deviceId = '';
    getDeviceId().then(id => {
      deviceId = id;
      setCurrentDeviceId(auth.currentUser?.uid || deviceId);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentDeviceId(user.uid);
      } else if (deviceId) {
        setCurrentDeviceId(deviceId);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentDeviceId) return;

    const q = query(
      collection(db, 'relatos'),
      where('ownerId', '==', currentDeviceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      // Ordenação por upvotes e data (igual aba principal)
      data.sort((a, b) => {
        const upA = a.upvotes || 0;
        const upB = b.upvotes || 0;
        if (upA !== upB) return upB - upA;
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setRelatos(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar meus relatos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentDeviceId]);

  return (
    <View style={styles.sceneContainer}>
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" />
      ) : relatos.length === 0 ? (
        <View style={{ alignItems: 'center' }}>
          <FontAwesome6 name="user-pen" size={48} color="#cbd5e1" />
          <Text style={styles.sceneText}>Você ainda não criou nenhum relato</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 24 }}
          showsVerticalScrollIndicator={false}
          style={{ width: '100%', flex: 1 }}
        >
          {relatos.map((relato, index) => (
            <RelatoItem 
              key={relato.id} 
              relato={relato} 
              currentDeviceId={currentDeviceId} 
              index={index} 
              showCityHeader={true} 
              onViewOnMap={(r) => {
                router.push({
                  pathname: '/home',
                  params: { focusLat: r.latitude, focusLng: r.longitude, switchTab: 'relatos' }
                });
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const Rascunhos = () => {
  const [rascunhos, setRascunhos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  
  const [editingDraft, setEditingDraft] = useState<any | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    let deviceId = '';
    getDeviceId().then(id => {
      deviceId = id;
      setCurrentDeviceId(auth.currentUser?.uid || deviceId);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentDeviceId(user.uid);
      } else if (deviceId) {
        setCurrentDeviceId(deviceId);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentDeviceId) return;

    const q = query(
      collection(db, 'rascunhos'),
      where('ownerId', '==', currentDeviceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      // Ordem: mais recentes editados primeiro
      data.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis() || 0;
        const timeB = b.updatedAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setRascunhos(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar rascunhos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentDeviceId]);

  const handleEdit = (rascunho: any) => {
    setEditingDraft(rascunho);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setEditingDraft(null);
    setIsModalVisible(false);
  };

  return (
    <View style={styles.sceneContainer}>
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" />
      ) : rascunhos.length === 0 ? (
        <View style={{ alignItems: 'center' }}>
          <FontAwesome6 name="pen-ruler" size={48} color="#cbd5e1" />
          <Text style={styles.sceneText}>Seus rascunhos aparecerão aqui</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 24 }}
          showsVerticalScrollIndicator={false}
          style={{ width: '100%', flex: 1 }}
        >
          {rascunhos.map((rascunho, index) => (
            <RascunhoItem 
              key={rascunho.id} 
              rascunho={rascunho} 
              index={index} 
              onEdit={handleEdit}
            />
          ))}
        </ScrollView>
      )}

      {/* Modal para edição de rascunhos */}
      <AddRelatoModal 
        visible={isModalVisible} 
        onClose={handleCloseModal}
        draftData={editingDraft ? { texto: editingDraft.texto, crimeKey: editingDraft.crimeKey } : undefined}
        draftId={editingDraft?.id}
        initialLocation={editingDraft?.latitude && editingDraft?.longitude ? { latitude: editingDraft.latitude, longitude: editingDraft.longitude } : undefined}
        initialCityName={editingDraft?.cidade}
        onChangeLocation={async (text, crimeKey) => {
          if (editingDraft?.id) {
            await updateDoc(doc(db, 'rascunhos', editingDraft.id), { texto: text, crimeKey });
          }
          handleCloseModal();
          router.push({ pathname: '/(tabs)/relatos', params: { editDraftId: editingDraft?.id } });
        }}
      />
    </View>
  );
};

const Salvos = () => {
  const router = useRouter();
  const [relatos, setRelatos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let deviceId = '';
    getDeviceId().then(id => {
      deviceId = id;
      setCurrentDeviceId(auth.currentUser?.uid || deviceId);
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentDeviceId(user.uid);
      } else if (deviceId) {
        setCurrentDeviceId(deviceId);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentDeviceId) return;

    const q = query(
      collection(db, 'relatos'),
      where('bookmarkedBy', 'array-contains', currentDeviceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      // Ordenação por upvotes e data
      data.sort((a, b) => {
        const upA = a.upvotes || 0;
        const upB = b.upvotes || 0;
        if (upA !== upB) return upB - upA;
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setRelatos(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar relatos salvos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentDeviceId]);

  return (
    <View style={styles.sceneContainer}>
      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" />
      ) : relatos.length === 0 ? (
        <View style={{ alignItems: 'center' }}>
          <FontAwesome6 name="bookmark" size={48} color="#cbd5e1" />
          <Text style={styles.sceneText}>Você não possui relatos salvos</Text>
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 24 }}
          showsVerticalScrollIndicator={false}
          style={{ width: '100%', flex: 1 }}
        >
          {relatos.map((relato, index) => (
            <RelatoItem 
              key={relato.id} 
              relato={relato} 
              currentDeviceId={currentDeviceId} 
              index={index} 
              showCityHeader={true} 
              onViewOnMap={(r) => {
                router.push({
                  pathname: '/home',
                  params: { focusLat: r.latitude, focusLng: r.longitude, switchTab: 'relatos' }
                });
              }}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default function Biblioteca() {
  const router = useRouter();
  
  const [fontsLoaded] = useFonts({
    texgyR: require('../../assets/fontes/texgyreadventor-regular.otf'),
    texgyB: require('../../assets/fontes/texgyreadventor-bold.otf'),
  });

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'meus_relatos', title: 'Meus relatos', icon: 'user-pen' },
    { key: 'rascunhos', title: 'Rascunhos', icon: 'pen-ruler' },
    { key: 'salvos', title: 'Salvos', icon: 'bookmark' },
  ]);

  const renderScene = SceneMap({
    meus_relatos: MeusRelatos,
    rascunhos: Rascunhos,
    salvos: Salvos,
  });

  const renderTabBar = () => null;

  if (!fontsLoaded) return null;

  const handleTabPress = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIndex(i);
  };

  return (
    <View style={styles.container}>
      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={handleTabPress}
        initialLayout={initialLayout}
        renderTabBar={renderTabBar}
      />
      <View style={styles.overlayContainer} pointerEvents="box-none">
        
        {/* Nav Bar Superior Própria (Mesmo estilo do TopMenu mas com título e voltar) */}
        <View style={styles.topSection}>
          <Spacer />
          <View style={styles.customTopMenu}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
              <FontAwesome6 name="arrow-left" size={18} color="#333" />
            </TouchableOpacity>
            
            <View style={styles.titleContainer}>
              <FontAwesome6 name="book-bookmark" size={18} color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.titleText}>Biblioteca</Text>
            </View>
            
            {/* Espaçador invisível para manter o título centralizado */}
            <View style={[styles.backButton, { backgroundColor: 'transparent' }]} pointerEvents="none" />
          </View>
        </View>

        {/* Cápsulas de navegação das abas internas */}
        <View style={styles.capsulesContainer} pointerEvents="box-none">
          {routes.map((route, i) => {
             const isActive = index === i;
             return (
                 <AnimatedTouchableOpacity
                 key={route.key}
                 style={[styles.capsule, isActive && styles.capsuleActive]}
                 onPress={() => handleTabPress(i)}
                 activeOpacity={0.8}
                 layout={LinearTransition.duration(250)}
               >
                 {/* Invisible placeholder to drive the capsule's layout size instantly */}
                 <View style={{ opacity: 0 }} pointerEvents="none">
                   {isActive ? (
                     <Text style={[styles.capsuleText, styles.capsuleTextActive]}>
                       {route.title}
                     </Text>
                   ) : (
                     <FontAwesome6 name={route.icon} size={16} color="#666" />
                   )}
                 </View>

                 {/* Absolute elements for smooth crossfade without layout interference */}
                 {isActive ? (
                   <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                     <Text style={[styles.capsuleText, styles.capsuleTextActive]}>
                       {route.title}
                     </Text>
                   </Animated.View>
                 ) : (
                   <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
                     <FontAwesome6 name={route.icon} size={16} color="#666" />
                   </Animated.View>
                 )}
               </AnimatedTouchableOpacity>
             );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topSection: {
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  customTopMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#e4e4e4',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleText: {
    fontFamily: 'texgyB',
    fontSize: 18,
    color: '#000',
  },
  capsulesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
    gap: 10,
  },
  capsule: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 45,
  },
  capsuleActive: {
    backgroundColor: '#fff',
  },
  capsuleText: {
    fontFamily: 'texgyR',
    fontSize: 14,
    color: '#666',
  },
  capsuleTextActive: {
    color: '#000',
    fontFamily: 'texgyB',
  },
  sceneContainer: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 160,
  },
  sceneText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  }
});
