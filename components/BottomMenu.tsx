import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const tabs = [
  { name: 'home', icon: 'home' },
  { name: 'notificacoes', icon: 'bell' },
  { name: 'conta', icon: 'user' },
  { name: 'configuracoes', icon: 'settings' },
];

function Spacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingBottom: insets.bottom, backgroundColor: "#000000ff" }}></View>
}

export default function BottomMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.floatingWrapper, { bottom: Math.max(insets.bottom + 20, 30) }]}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = pathname === `/${tab.name}`;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => {
                if (!isActive) router.push(`/${tab.name}`);
              }}
              style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}
            >
              <Feather
                name={tab.icon as any}
                size={22}
                color={isActive ? '#fff' : '#000'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 16,
    borderRadius: 26,
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  iconWrapperActive: {
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
});