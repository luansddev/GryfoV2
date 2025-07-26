import { View, Text, StyleSheet } from 'react-native';

export default function Dados() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Dados</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // centraliza verticalmente
    alignItems: 'center',     // centraliza horizontalmente
    backgroundColor: '#F5F5F5',
  },
  text: {
    fontSize: 20,
  },
});
