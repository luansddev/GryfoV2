import { View, Text, StyleSheet, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';

const imagensExemplo = [
  "https://i.pinimg.com/736x/89/2e/a0/892ea0e1ca27e93af7b1d91efc394c0e.jpg"
];

function Spacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top, backgroundColor: "#ffffffff" }} />;
}

interface NotificationProps {
  index: number;
  imagem: string;
  nomeUsuario: string;
  mensagem: string;
  data: Date | number | string;
  onPressButton?: () => void;
}

type Mensagem = {
  imagem: string;
  nomeUsuario: string;
  mensagem: string;
  data: string | Date | number;
};

type GrupoMensagem = {
  title: string;
  data: Mensagem[];
};

const formatarData = (dataString: string): string => {
  const [ano, mes, dia] = dataString.split("-");
  return `${dia}/${mes}/${ano}`;
};

const extrairHorario = (timestamp: any) => {
  const data = new Date(timestamp);
  const horas = data.getHours().toString().padStart(2, '0');
  const minutos = data.getMinutes().toString().padStart(2, '0');
  return `${horas}:${minutos}`;
};

const agruparMensagensPorDia = (mensagens: Mensagem[]): GrupoMensagem[] => {
  // Primeiro, ordenar todas as mensagens por data (mais recente primeiro)
  const mensagensOrdenadas = [...mensagens].sort((a, b) => {
    const dataA = new Date(a.data).getTime();
    const dataB = new Date(b.data).getTime();
    return dataB - dataA;
  });

  const grupos: Record<string, Mensagem[]> = {};

  mensagensOrdenadas.forEach((mensagem) => {
    const data = new Date(mensagem.data);

    const chaveDia = `${data.getFullYear()}-${(data.getMonth() + 1).toString().padStart(2, '0')}-${data.getDate().toString().padStart(2, '0')}`

    if (!grupos[chaveDia]) {
      grupos[chaveDia] = [];
    }

    grupos[chaveDia].push(mensagem);
  });

  return Object.keys(grupos)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map(chave => ({
      title: formatarData(chave),
      data: grupos[chave].sort((a, b) => {
        const dataA = new Date(a.data).getTime();
        const dataB = new Date(b.data).getTime();
        return dataB - dataA;
      })
    }));
};

function Notification1({ index, imagem, nomeUsuario, mensagem, data }: NotificationProps) {
  return (
    <View style={styles.notification1}>
      <View style={styles.notification1_image_container}>
        <Image
          source={{ uri: imagem }}
          style={styles.notificationImage}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={index === 0 ? styles.img_first : index === -1 ? {} : index === 99999 ? styles.img_last : styles.img_mid} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        <Text>{nomeUsuario} lhe enviou: {mensagem}</Text>
        {/*<Text>{TempoOcorrido(data)}</Text>*/}
        <Text>{extrairHorario(data)}</Text>
      </View>
      <TouchableOpacity>
        <FontAwesome6 name="ellipsis-vertical" size={18} />
      </TouchableOpacity>
    </View>
  );
}

export default function Notificacoes() {
  const usuarioExemplo: Mensagem[] = [
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "Nicolas",
      mensagem: "Bom dia!",
      data: new Date(2025, 0, 10, 17, 30).getTime()
    },
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "Nicolas",
      mensagem: "Bom dia!",
      data: new Date(2025, 0, 10, 8, 30).getTime()
    },
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "Maria",
      mensagem: "Como você está?",
      data: new Date(2023, 0, 10, 14, 30).getTime()
    },
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "",
      mensagem: "Como você está?",
      data: new Date(2023, 0, 10, 14, 30).getTime()
    },
    {
      imagem: imagensExemplo[0],
      nomeUsuario: "João",
      mensagem: "Ótimo conteúdo!",
      data: new Date(2024, 0, 10, 14, 30).getTime()
    },
  ];

  const [messages] = useState(usuarioExemplo);
  const [mensagensAgrupadas] = useState(agruparMensagensPorDia(usuarioExemplo));

  return (
    <View style={styles.container}>
      <Spacer />
      <Text style={styles.text}>Notificações</Text>
      <ScrollView style={{ flex: 1 }}>
        {mensagensAgrupadas.map((grupo, grupoIndex) => (
          <View key={grupoIndex}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, paddingHorizontal: 20, marginTop: 10 }}>
              {grupo.title}
            </Text>
            {grupo.data.map((message, index) => (
              <Notification1
                key={`${grupoIndex}-${index}`}
                index={index === grupo.data.length - 1 && index === 0 ? -1 : index != grupo.data.length - 1 ? index : 99999}
                imagem={message.imagem}
                nomeUsuario={message.nomeUsuario}
                mensagem={message.mensagem}
                data={message.data}
              />
            ))}
          </View>
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
    marginVertical: 20,
    maxHeight: 150
  },
  notificationImage: {
    width: 50,
    height: 50,
    zIndex: 1,
    borderRadius: Platform.select({
      ios: 500,
      android: 250,
      default: 500
    })
  },
  img_first: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 3,
    height: 65,
    backgroundColor: "gray"
  },
  img_mid: {
    position: "absolute",
    left: "50%",
    top: -20,
    width: 3,
    height: 140, // Ajuste para valor fixo
    backgroundColor: "gray"
  },
  img_last: {
    position: "absolute",
    left: "50%",
    top: -20,
    width: 3,
    height: 80,
    backgroundColor: "gray"
  },
  notification1_image_container: {
    position: "relative",
    paddingVertical: 10
  }
});
