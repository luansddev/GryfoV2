import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const tabs = [
  { name: 'home', icon: 'home' },
  { name: 'notificacoes', icon: 'notifications' },
  { name: 'conta', icon: 'person' },
  { name: 'configuracoes', icon: 'settings' },
];

function Spacer(){
  const insets = useSafeAreaInsets(); // usei pra espaçamento (mesmo pkg do safeAreaView)
  
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
            <MaterialIcons
              name={tab.icon as any}
              size={34}
              color={isActive ? '#fff' : '#808080'}
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
