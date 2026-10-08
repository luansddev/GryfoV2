import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useVigias, VigiaNotification, formatDistance } from '../context/VigiasContext';
import { formatCrimeName, getCrimeIcon } from '../constants/CrimeData';
import { TempoOcorrido } from '../utils/timestampRelative';
import TabTransitionView from '../components/TabTransitionView';

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

/* ================= CARD ================= */

interface NotificationCardProps {
  notification: VigiaNotification;
  index: number;
  onPress: () => void;
  onRemove: () => void;
}

function NotificationCard({ notification, index, onPress, onRemove }: NotificationCardProps) {
  const isUpvote = notification.type === 'upvote_milestone';
  const crime = notification.crimeKey ? getCrimeIcon(notification.crimeKey) : { icon: 'comment-dots', color: '#2563eb' };
  
  let title = '';
  if (isUpvote) {
    const n = notification as any;
    title = n.milestone === 1 ? 'Seu relato recebeu o primeiro incentivo!' : `Seu relato recebeu ${n.milestone} incentivos`;
  } else {
    title = notification.crimeKey ? formatCrimeName(notification.crimeKey) : 'Novo relato';
  }

  const badgeIcon = isUpvote ? 'arrow-up' : 'eye';
  const badgeColor = isUpvote ? '#eab308' : '#1d4ed8';

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(260)}
      exiting={FadeOut.duration(180)}
      layout={LinearTransition.duration(220)}
    >
      <TouchableOpacity
        style={[styles.card, !notification.read && styles.cardUnread]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        <View style={[styles.cardIcon, { backgroundColor: `${crime.color}14`, borderColor: `${crime.color}33` }]}>
          <FontAwesome6 name={crime.icon as any} size={17} color={crime.color} />
          <View style={[styles.cardIconBadge, { backgroundColor: badgeColor }]}>
            <FontAwesome6 name={badgeIcon as any} size={8} color="#fff" />
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>
              {title}
            </Text>
            <Text style={styles.cardTime}>{extrairHorario(notification.relatoCreatedAt)}</Text>
          </View>

          {isUpvote ? (
            <Text style={styles.cardVigia} numberOfLines={1}>
              Relato de <Text style={styles.cardVigiaName}>{notification.crimeKey ? formatCrimeName(notification.crimeKey) : 'aviso'}</Text>
            </Text>
          ) : (
            <Text style={styles.cardVigia} numberOfLines={1}>
              Vigia <Text style={styles.cardVigiaName}>"{notification.type === 'vigia_relato' ? (notification as any).vigiaNames[0] : ''}"</Text>
              {(notification.type === 'vigia_relato' && (notification as any).vigiaNames.length > 1) ? ` +${(notification as any).vigiaNames.length - 1}` : ''} · {formatDistance(notification.type === 'vigia_relato' ? (notification as any).distance : 0)}
            </Text>
          )}

          {!!notification.texto && (
            <Text style={styles.cardText} numberOfLines={2}>
              {notification.texto}
            </Text>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.cardRelative}>{TempoOcorrido(notification.relatoCreatedAt)}</Text>
            <View style={styles.cardLink}>
              <Text style={styles.cardLinkText}>Ver no mapa</Text>
              <FontAwesome6 name="location-arrow" size={9} color="#2563eb" />
            </View>
          </View>
        </View>

        <View style={styles.cardSide}>
          {!notification.read && <View style={styles.unreadDot} />}
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.removeBtn}
          >
            <FontAwesome6 name="xmark" size={13} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ================= TELA ================= */

export default function Notificacoes() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications, vigias } = useVigias();
  const [confirmClear, setConfirmClear] = useState(false);

  const grupos = useMemo(() => agruparPorDia(notifications), [notifications]);

  const handleOpen = (n: VigiaNotification) => {
    markAsRead(n.id);
    router.push({
      pathname: '/home',
      params: { focusLat: n.latitude, focusLng: n.longitude, switchTab: 'relatos', openRelatoId: n.relatoId },
    });
  };

  let cardIndex = 0;

  return (
    <TabTransitionView style={styles.container}>
      <View style={{ paddingTop: insets.top }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Atividade</Text>
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
            >
              <FontAwesome6 name="check-double" size={13} color={unreadCount === 0 ? '#cbd5e1' : '#0f172a'} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {notifications.length === 0 ? (
        <Animated.View entering={FadeInUp.duration(300)} style={styles.empty}>
          <View style={styles.emptyIconOuter}>
            <View style={styles.emptyIconInner}>
              <FontAwesome6 name="bolt" size={26} color="#2563eb" />
            </View>
          </View>
          <Text style={styles.emptyTitle}>
            Nenhuma atividade ainda
          </Text>
          <Text style={styles.emptyText}>
            As notificações dos seus vigias e as atualizações dos relatos que você criar aparecerão aqui.
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
          {grupos.map(grupo => (
            <View key={grupo.title}>
              <Text style={styles.groupTitle}>{grupo.title}</Text>
              {grupo.data.map(n => (
                <NotificationCard
                  key={n.id}
                  notification={n}
                  index={cardIndex++}
                  onPress={() => handleOpen(n)}
                  onRemove={() => removeNotification(n.id)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

    </TabTransitionView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 10,
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  headerBtnDisabled: {
    opacity: 0.6,
  },

  groupTitle: {
    fontSize: 13,
    fontFamily: 'texgyB',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 22,
    marginTop: 16,
    marginBottom: 8,
  },

  /* Card */
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardUnread: {
    borderColor: 'rgba(37, 99, 235, 0.25)',
    backgroundColor: '#f8faff',
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardIconBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1d4ed8',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'texgyB',
    color: '#0f172a',
  },
  cardTime: {
    fontSize: 12,
    fontFamily: 'texgyR',
    color: '#94a3b8',
  },
  cardVigia: {
    fontSize: 12,
    fontFamily: 'texgyR',
    color: '#475569',
    marginTop: 3,
  },
  cardVigiaName: {
    fontFamily: 'texgyB',
    color: '#1d4ed8',
  },
  cardText: {
    fontSize: 13,
    fontFamily: 'texgyR',
    color: '#334155',
    marginTop: 8,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  cardRelative: {
    fontSize: 11,
    fontFamily: 'texgyR',
    color: '#94a3b8',
  },
  cardLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLinkText: {
    fontSize: 12,
    fontFamily: 'texgyB',
    color: '#2563eb',
  },
  cardSide: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 8,
    paddingVertical: 2,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  removeBtn: {
    marginTop: 'auto',
    padding: 2,
  },

  /* Empty */
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 120,
  },
  emptyIconOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
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
    backgroundColor: '#1d4ed8',
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
    width: 56,
    height: 56,
    borderRadius: 28,
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
