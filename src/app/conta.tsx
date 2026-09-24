import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '../config/firebaseConfig';
import { signOut } from 'firebase/auth';
import { FontAwesome6 } from '@expo/vector-icons';

export default function Conta() {
  const router = useRouter();

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
      <Text style={styles.title}>Minha Conta</Text>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <FontAwesome6 name="arrow-right-from-bracket" size={18} color="#fff" style={styles.icon} />
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    backgroundColor: '#e2e8f0'
  },
  title: { 
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#1f2937'
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  icon: {
    marginRight: 12,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  }
});
