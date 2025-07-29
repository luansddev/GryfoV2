import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const tabs = [
  { name: 'home', icon: 'home' },
  { name: 'notificacoes', icon: 'notifications' },
  { name: 'conta', icon: 'person' },
  { name: 'configuracoes', icon: 'settings' },
];

export default function BottomMenu() {
  const pathname = usePathname();
  const router = useRouter();

  return (
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
              size={28}
              color={isActive ? '#fff' : '#808080'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingBottom: 20,
    height: 80,
    alignItems: "center",
  },
  iconWrapper: {
    alignItems: 'center',
  },
});
