import { View, Text, StyleSheet } from 'react-native';
import TabTransitionView from '../components/TabTransitionView';

export default function Configuracoes() {
  return (
    <TabTransitionView style={styles.container}>
      <Text style={styles.text}>Configurações</Text>
    </TabTransitionView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 20 }
});
