import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
// ALTERAÇÃO 1: Mudar a importação da biblioteca de ícones
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ALTERAÇÃO 2: Atualizar os nomes dos ícones para o padrão da nova biblioteca
const tabs = [
  { name: 'home', iconFilled: 'home', iconOutlined: 'home-outline' },
  { name: 'notificacoes', iconFilled: 'bell', iconOutlined: 'bell-outline' },
  { name: 'conta', iconFilled: 'account', iconOutlined: 'account-outline' },
  { name: 'configuracoes', iconFilled: 'cog', iconOutlined: 'cog-outline' },
];

function Spacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingBottom: insets.bottom, backgroundColor: "#000000ff" }}></View>
}

export default function BottomMenu() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = pathname === `/${tab.name}`;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => {
                if (!isActive) router.push(`/${tab.name}`);
              }}
              style={styles.iconWrapper}
            >
              {/* ALTERAÇÃO 3: Usar o novo componente de ícone */}
              <MaterialCommunityIcons
                name={isActive ? tab.iconFilled : tab.iconOutlined as any}
                size={32}
                color={isActive ? '#fff' : '#bbbbbbff'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <Spacer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: '#000000ff',
    paddingBottom: 20,
    paddingVertical: 10,
    height: 80,
    alignItems: "center",
  },
  iconWrapper: {
    alignItems: 'center',
  },
});