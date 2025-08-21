import { View, Text, StyleSheet, Platform, Button, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TempoOcorrido } from '../utils/timestampRelative';
import { FontAwesome6 } from '@expo/vector-icons';

const imagensExemplo = ["https://i.pinimg.com/736x/89/2e/a0/892ea0e1ca27e93af7b1d91efc394c0e.jpg", ]

function Spacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: "#ffffffff" }}></View>
}

interface NotificationProps {
  imagem: string;
  nomeUsuario: string;
  mensagem: string;
  data: Date | number | string;
  onPressButton?: () => void;
}

function Notification1({ imagem, nomeUsuario, mensagem, data }: NotificationProps){
  return (
    <View style={styles.notification1}>
      <Image
        source={{ uri: imagem }}
        style={styles.notificationImage}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <Text style={{ flex: 1 }}>{nomeUsuario} lhe enviou: {mensagem}</Text>
        <Text>{TempoOcorrido(data)}</Text>
      </View>
      <TouchableOpacity>
        <FontAwesome6
          name="ellipsis-vertical"
          size={18}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function Notificacoes() {
  const usuarioExemplo = [
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "Nicolas",
      mensagem: "Bom dia!",
      data: new Date(2025, 0, 10, 14, 30).getTime() // 2024/01/10 14:30  ano mês dia
    },
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "Maria",
      mensagem: "Como você está?",
      data: new Date(2023, 0, 10, 14, 30).getTime()
    },
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "João",
      mensagem: "Ótimo conteúdo!",
      data: new Date(2024, 0, 10, 14, 30).getTime()
    }
  ];

  const [messages, setMessages] = useState(usuarioExemplo);

  return (
    <View style={styles.container}>
      <Spacer />
      <Text style={styles.text}>Notificações</Text>
      <ScrollView style={{ flex: 1 }}>
        {messages.map((message, index) => (
          <Notification1
            key={index}
            imagem={message.imagem}
            nomeUsuario={message.nomeUsuario}
            mensagem={message.mensagem}
            data={message.data}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  text: {
    fontSize: 20,
    paddingHorizontal: 30
  },
  notification1: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 20,
    maxHeight: 150
  },
  notificationImage: {
    width: 60,
    height: 60,
    borderRadius: Platform.select({
      ios: 500,
      android: 250,
      default: 500
    })
  }
});
