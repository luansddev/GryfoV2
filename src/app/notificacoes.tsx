import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  PanResponder,
  Animated as RNAnimated,
  Dimensions,
} from 'react-native';
import { useMemo, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useVigias, VigiaNotification, ReportNotification, formatDistance } from '../context/VigiasContext';
import { formatCrimeName, getCrimeIcon } from '../constants/CrimeData';
import TabTransitionView from '../components/TabTransitionView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type GrupoNotificacoes = {
  title: string;
  data: VigiaNotification[];
};

const extrairHorario = (timestamp: number) => {
  const data = new Date(timestamp);
  const horas = data.getHours().toString().padStart(2, '0');
  const minutos = data.getMinutes().toString().padStart(2, '0');
  return `${horas}:${minutos}`;
};

const tituloDoDia = (timestamp: number): string => {
  const data = new Date(timestamp);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);

  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (mesmoDia(data, hoje)) return 'Hoje';
  if (mesmoDia(data, ontem)) return 'Ontem';
  const dia = data.getDate().toString().padStart(2, '0');
  const mes = (data.getMonth() + 1).toString().padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
};

const agruparPorDia = (notificacoes: VigiaNotification[]): GrupoNotificacoes[] => {
  const ordenadas = [...notificacoes].sort((a, b) => b.relatoCreatedAt - a.relatoCreatedAt);
  const grupos: GrupoNotificacoes[] = [];

  ordenadas.forEach(n => {
    const title = tituloDoDia(n.relatoCreatedAt);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.title === title) ultimo.data.push(n);
    else grupos.push({ title, data: [n] });
  });

  return grupos;
};

/* ================= ROW ITEM (SWIPE-TO-DELETE COM CONFIRMAÇÃO) ================= */

interface NotificationItemProps {
  notification: VigiaNotification;
  index: number;
  isLast: boolean;
  onPress: () => void;
  onRemove: () => void;
}

function NotificationItem({ notification, index, isLast, onPress, onRemove }: NotificationItemProps) {
  const isUpvote = notification.type === 'upvote_milestone';
  const isReport = notification.type === 'report_received';
  const crime = notification.crimeKey ? getCrimeIcon(notification.crimeKey) : { icon: 'comment-dots', color: '#2563eb' };

  const panX = useRef(new RNAnimated.Value(0)).current;
  const isDeletingRef = useRef(false);
  const [isPrimed, setIsPrimed] = useState(false);

  // Limite para confirmar exclusão: o usuário deve puxar cerca de 42% da tela até o final
  const DELETE_THRESHOLD = SCREEN_WIDTH * 0.42;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Captura apenas gestos estritamente horizontais para não prejudicar o scroll vertical
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        isDeletingRef.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx > 0) {
          // Deslizando para a direita (revela a lateral vermelha com lixeira à esquerda)
          panX.setValue(Math.min(SCREEN_WIDTH, gestureState.dx));
          const primed = gestureState.dx >= DELETE_THRESHOLD;
          setIsPrimed(primed);
        } else {
          // Bloqueia deslizamento para a esquerda
          panX.setValue(0);
          setIsPrimed(false);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > DELETE_THRESHOLD || gestureState.vx > 1.2) {
          // Puxou até o final para a direita: confirma a exclusão!
          isDeletingRef.current = true;
          RNAnimated.timing(panX, {
            toValue: SCREEN_WIDTH,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            onRemove();
          });
        } else {
          // "Aquela segurada": se soltar antes do final, volta suavemente para a posição inicial
          setIsPrimed(false);
          RNAnimated.spring(panX, {
            toValue: 0,
            bounciness: 4,
            speed: 14,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        setIsPrimed(false);
        RNAnimated.spring(panX, {
          toValue: 0,
          bounciness: 4,
          speed: 14,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // 1. Linha 1: Categoria / Tag superior
  let category = '';
  if (isReport) {
    category = 'Denúncias';
  } else if (isUpvote) {
    category = 'Incentivos';
  } else {
    const vigiaNames = (notification as any).vigiaNames;
    category = vigiaNames && vigiaNames.length > 0 ? `Vigia · ${vigiaNames[0]}` : 'Vigias';
  }

  // 2. Linha 2: Título em destaque (Headline)
  let headline = '';
  if (isReport) {
    headline = 'Denúncia registrada com sucesso';
  } else if (isUpvote) {
    const n = notification as any;
    headline = n.milestone === 1 ? 'Seu relato recebeu o primeiro incentivo!' : `Seu relato recebeu ${n.milestone} incentivos!`;
  } else {
    const crimeTitle = notification.crimeKey ? formatCrimeName(notification.crimeKey) : 'Novo relato na região';
    const dist = (notification as any).distance ? ` · a ${formatDistance((notification as any).distance)}` : '';
    headline = `${crimeTitle}${dist}`;
  }

  // 3. Linha 3: Descrição secundária (Snippet / Detalhe)
  let snippet = '';
  if (isReport) {
    const r = notification as ReportNotification;
    snippet = r.motivoLabel
      ? `Motivo: ${r.motivoLabel}. Obrigado por colaborar com a comunidade.`
      : 'Recebemos sua denúncia. Você será notificado quando avaliarmos o caso.';
  } else if (isUpvote) {
    snippet = notification.crimeKey
      ? `Relato de ${formatCrimeName(notification.crimeKey)}. A comunidade está apoiando seu aviso.`
      : 'A comunidade está apoiando as informações do seu relato.';
  } else {
    snippet = notification.texto || 'Toque para visualizar este relato e sua localização exata no mapa.';
  }

  // Cores e ícone do círculo esquerdo (estilo suave pastel)
  let circleBg = '#e6f4f1';
  let iconColor = '#0f766e';
  let iconName: any = crime.icon || 'shield-halved';

  if (isReport) {
    circleBg = '#fee2e2';
    iconColor = '#dc2626';
    iconName = 'flag';
  } else if (isUpvote) {
    circleBg = '#fef3c7';
    iconColor = '#d97706';
    iconName = 'arrow-trend-up';
  } else {
    circleBg = '#e6f4f1';
    iconColor = '#0f766e';
    iconName = crime.icon || 'shield-halved';
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.duration(200)}
      style={styles.swipeRowWrapper}
    >
      {/* Fundo vermelho com ícone de lixeira revelado ao deslizar */}
      <View style={styles.swipeRedBackground}>
        <View style={styles.swipeActionContent}>
          <FontAwesome6
            name="trash-can"
            size={19}
            color="#ffffff"
          />
          <Text style={styles.swipeActionText}>
            {isPrimed ? 'Solte para excluir' : 'Puxe até o final'}
          </Text>
        </View>
      </View>

      {/* Conteúdo frontal do item com PanResponder */}
      <RNAnimated.View
        style={[
          styles.itemFront,
          { transform: [{ translateX: panX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[styles.itemContainer, !notification.read && styles.itemContainerUnread]}
          activeOpacity={0.7}
          onPress={() => {
            if (!isDeletingRef.current) {
              onPress();
            }
          }}
        >
          {/* Círculo do ícone à esquerda */}
          <View style={[styles.iconCircle, { backgroundColor: circleBg }]}>
            <FontAwesome6 name={iconName} size={19} color={iconColor} />
          </View>

          {/* Coluna principal de texto (4 linhas conforme imagem) */}
          <View style={styles.itemContent}>
            {/* Linha 1: Categoria em negrito + Ponto verde de não lida à direita */}
            <View style={styles.categoryRow}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {category}
              </Text>
              {!notification.read && <View style={styles.unreadDot} />}
            </View>

            {/* Linha 2: Título / Headline */}
            <Text style={styles.headlineText} numberOfLines={1}>
              {headline}
            </Text>

            {/* Linha 3: Descrição / Corpo */}
            <Text style={styles.snippetText} numberOfLines={2}>
              {snippet}
            </Text>

            {/* Linha 4: Horário */}
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>
                {extrairHorario(notification.relatoCreatedAt)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Linha divisória fina entre itens */}
        {!isLast && <View style={styles.itemDivider} />}
      </RNAnimated.View>
    </Animated.View>
  );
}

/* ================= TELA ================= */

export default function Notificacoes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications, vigias } = useVigias();
  const [confirmClear, setConfirmClear] = useState(false);

  // Notificação flutuante no footer (toast)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  };

  const grupos = useMemo(() => agruparPorDia(notifications), [notifications]);

  const handleOpen = (n: VigiaNotification) => {
    markAsRead(n.id);
    if (typeof n.latitude === 'number' && typeof n.longitude === 'number' && n.latitude !== 0 && n.longitude !== 0) {
      router.push({
        pathname: '/home',
        params: { focusLat: n.latitude, focusLng: n.longitude, switchTab: 'relatos', openRelatoId: n.relatoId },
      });
    } else {
      router.push({
        pathname: '/home',
        params: { switchTab: 'relatos', openRelatoId: n.relatoId },
      });
    }
  };

  const handleRemove = (id: string) => {
    removeNotification(id);
    showToast('Notificação excluída');
  };

  let globalIndex = 0;

  return (
    <TabTransitionView style={styles.container}>
      <View style={{ paddingTop: insets.top }} />

      {/* Header clean */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notificações</Text>
          <Text style={styles.subtitle}>
            {notifications.length === 0
              ? vigias.length > 0
                ? `${vigias.length} vigia${vigias.length > 1 ? 's' : ''} monitorando`
                : 'Alertas dos seus vigias aparecem aqui'
              : unreadCount > 0
                ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
                : 'Tudo em dia'}
          </Text>
        </View>

        {notifications.length > 0 && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, unreadCount === 0 && styles.headerBtnDisabled]}
              onPress={markAllAsRead}
              disabled={unreadCount === 0}
              activeOpacity={0.7}
              accessibilityLabel="Marcar todas como lidas"
            >
              <FontAwesome6 name="check-double" size={13} color={unreadCount === 0 ? '#cbd5e1' : '#0f766e'} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setConfirmClear(true)}
              activeOpacity={0.7}
              accessibilityLabel="Limpar notificações"
            >
              <FontAwesome6 name="trash-can" size={13} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {notifications.length === 0 ? (
        <Animated.View entering={FadeInUp.duration(300)} style={styles.empty}>
          <View style={styles.emptyIconOuter}>
            <View style={styles.emptyIconInner}>
              <FontAwesome6 name="bell" size={26} color="#0f766e" />
            </View>
          </View>
          <Text style={styles.emptyTitle}>
            Nenhuma notificação
          </Text>
          <Text style={styles.emptyText}>
            As notificações dos seus vigias e as atualizações da comunidade aparecerão aqui.
          </Text>
          {vigias.length === 0 && (
            <TouchableOpacity
              style={styles.emptyBtn}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/home', params: { switchTab: 'locais' } })}
            >
              <FontAwesome6 name="plus" size={12} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.emptyBtnText}>Criar vigia</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
          {grupos.map((grupo) => (
            <View key={grupo.title} style={styles.groupSection}>
              <Text style={styles.groupTitle}>{grupo.title}</Text>
              <View style={styles.groupCard}>
                {grupo.data.map((n, idx) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    index={globalIndex++}
                    isLast={idx === grupo.data.length - 1}
                    onPress={() => handleOpen(n)}
                    onRemove={() => handleRemove(n.id)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Pequena notificação flutuante no footer informando a exclusão */}
      {toastMessage && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.toastContainer, { bottom: Math.max(24, insets.bottom + 12) }]}
          pointerEvents="none"
        >
          <View style={styles.toastCard}>
            <View style={styles.toastIconCircle}>
              <FontAwesome6 name="trash-can" size={11} color="#ef4444" />
            </View>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </Animated.View>
      )}

      {/* Modal de confirmação para limpar todas */}
      <Modal visible={confirmClear} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <FontAwesome6 name="trash-can" size={22} color="#dc2626" />
            </View>
            <Text style={styles.modalTitle}>Limpar Notificações</Text>
            <Text style={styles.modalText}>
              Tem certeza que deseja apagar todas as notificações? Esta ação não pode ser desfeita.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setConfirmClear(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  clearNotifications();
                  setConfirmClear(false);
                  showToast('Todas as notificações foram apagadas');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>Limpar Tudo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </TabTransitionView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 24,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#64748b',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnDisabled: {
    opacity: 0.5,
  },

  /* Grupos */
  groupSection: {
    backgroundColor: '#ffffff',
  },
  groupTitle: {
    fontSize: 12,
    fontFamily: 'texgyB',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  groupCard: {
    backgroundColor: '#ffffff',
  },

  /* Swipe Container */
  swipeRowWrapper: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#dc2626',
  },
  swipeRedBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 24,
  },
  swipeActionContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  swipeActionText: {
    fontSize: 10,
    fontFamily: 'texgyB',
    color: '#ffffff',
    marginTop: 4,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  /* Item frontal com fundo branco */
  itemFront: {
    backgroundColor: '#ffffff',
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
  },
  itemContainerUnread: {
    backgroundColor: '#fafcfb',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemContent: {
    flex: 1,
  },

  /* Linha 1: Categoria + Ponto verde de não lida */
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  categoryText: {
    fontSize: 15,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0f766e',
  },

  /* Linha 2: Headline */
  headlineText: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#1e293b',
    marginTop: 2,
  },

  /* Linha 3: Snippet */
  snippetText: {
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#64748b',
    marginTop: 3,
    lineHeight: 18,
  },

  /* Linha 4: Horário */
  timeRow: {
    marginTop: 5,
  },
  timeText: {
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#94a3b8',
  },

  /* Divisória fina */
  itemDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 82, // Alinhado com o início do conteúdo de texto
    marginRight: 20,
  },

  /* Footer Toast */
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 20,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  toastIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  toastText: {
    fontSize: 13,
    fontFamily: 'texgyB',
    color: '#ffffff',
  },

  /* Empty State */
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyIconOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e6f4f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1ebe6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'texgyB',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    marginTop: 22,
  },
  emptyBtnText: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#fff',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  modalText: {
    fontSize: 14,
    fontFamily: 'texgyR',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#475569',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: 'texgyB',
    color: '#fff',
  },
});
