import { Platform } from 'react-native';

/**
 * Wrapper seguro em torno do expo-notifications.
 *
 * O módulo é carregado via require dentro de try/catch para que o app continue
 * funcionando (apenas com notificações in-app) caso o dev build instalado ainda
 * não tenha o módulo nativo — ex.: antes de gerar um novo build.
 */

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('[notificações] expo-notifications indisponível neste build. Apenas notificações in-app serão exibidas.');
  Notifications = null;
}

export const VIGIA_CHANNEL_ID = 'vigias';

export interface VigiaNotificationPayload {
  type: 'vigia_relato' | 'upvote_milestone';
  notificationId?: string;
  relatoId?: string;
  latitude?: number;
  longitude?: number;
}

let setupPromise: Promise<boolean> | null = null;

/**
 * Configura handler de exibição em foreground, canal Android e pede permissão.
 * Idempotente: pode ser chamado várias vezes.
 */
export function setupLocalNotifications(): Promise<boolean> {
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    if (!Notifications) return false;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(VIGIA_CHANNEL_ID, {
          name: 'Alertas dos Vigias',
          description: 'Avisos de novos relatos dentro das áreas monitoradas pelos seus vigias',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 150, 250],
          lightColor: '#2563eb',
        });
      }

      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return true;
      if (!current.canAskAgain) return false;

      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch (e) {
      console.warn('[notificações] Falha ao configurar notificações locais:', e);
      return false;
    }
  })();

  return setupPromise;
}

/** Dispara imediatamente uma notificação local no sistema. */
export async function presentLocalNotification(
  title: string,
  body: string,
  data: VigiaNotificationPayload
): Promise<void> {
  if (!Notifications) return;
  try {
    const granted = await setupLocalNotifications();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data as unknown as Record<string, unknown>,
        sound: 'default',
      },
      trigger: Platform.OS === 'android' ? { channelId: VIGIA_CHANNEL_ID } : null,
    });
  } catch (e) {
    console.warn('[notificações] Falha ao exibir notificação local:', e);
  }
}

/**
 * Escuta toques do usuário nas notificações do sistema (inclusive a que abriu o app
 * a partir do estado "fechado"). Retorna a função de cleanup.
 */
export function addNotificationTapListener(
  callback: (data: VigiaNotificationPayload) => void
): () => void {
  if (!Notifications) return () => { };

  const handleResponse = (response: any) => {
    const data = response?.notification?.request?.content?.data as VigiaNotificationPayload | undefined;
    if (data?.type === 'vigia_relato') callback(data);
  };

  let subscription: { remove: () => void } | null = null;
  try {
    subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    // Caso o app tenha sido aberto (cold start) tocando em uma notificação
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (response) {
          handleResponse(response);
          Notifications?.clearLastNotificationResponseAsync?.().catch(() => { });
        }
      })
      .catch(() => { });
  } catch (e) {
    console.warn('[notificações] Falha ao registrar listener de toque:', e);
  }

  return () => subscription?.remove();
}
