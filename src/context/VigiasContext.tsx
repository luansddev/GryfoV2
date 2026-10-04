import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../config/firebaseConfig';
import { getDeviceId } from '../utils/device';
import { formatCrimeName } from '../constants/CrimeData';
import { presentLocalNotification, setupLocalNotifications } from '../services/notifications/localNotifications';

/* ================= TYPES ================= */

export interface Vigia {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // em metros
  createdAt: number;
  address?: string;
}

export type NotificationType = 'vigia_relato' | 'upvote_milestone';

export interface BaseNotification {
  id: string;
  type: NotificationType;
  relatoId: string;
  createdAt: number;
  read: boolean;
  relatoCreatedAt: number;
  latitude: number;
  longitude: number;
  crimeKey: string | null;
  texto: string;
}

export interface VigiaRelatoNotification extends BaseNotification {
  type: 'vigia_relato';
  vigiaIds: string[];
  vigiaNames: string[];
  distance: number;
}

export interface UpvoteNotification extends BaseNotification {
  type: 'upvote_milestone';
  milestone: number;
}

export type VigiaNotification = VigiaRelatoNotification | UpvoteNotification;

interface VigiasContextType {
  vigias: Vigia[];
  vigiasLoaded: boolean;
  saveVigias: (vigias: Vigia[]) => Promise<void>;

  notifications: VigiaNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

/* ================= CONSTANTES ================= */

/** Quantidade máxima de notificações guardadas localmente */
const MAX_NOTIFICATIONS = 200;
/** Janela máxima de "recuperação" ao abrir o app (relatos criados com o app fechado) */
const MAX_CATCHUP_MS = 7 * 24 * 60 * 60 * 1000;
/** Acima disso, a recuperação vira uma única notificação-resumo no sistema */
const MAX_INDIVIDUAL_SYSTEM_NOTIFICATIONS = 3;

/* ================= HELPERS ================= */

/** Distância em metros entre dois pontos (fórmula de Haversine) */
export function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 50) return 'a poucos metros';
  if (meters >= 1000) return `a ${(meters / 1000).toFixed(1).replace('.', ',')}km`;
  return `a ${Math.round(meters / 10) * 10}m`;
}

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

/* ================= CONTEXTO ================= */

const VigiasContext = createContext<VigiasContextType>(null as any);

export function VigiasProvider({ children }: { children: React.ReactNode }) {
  const [vigias, setVigias] = useState<Vigia[]>([]);
  const [vigiasLoaded, setVigiasLoaded] = useState(false);
  const [notifications, setNotifications] = useState<VigiaNotification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const ownerKey = authUid || deviceId;

  // Refs para o listener do Firestore sempre enxergar o estado mais recente
  const vigiasRef = useRef<Vigia[]>([]);
  const notificationsRef = useRef<VigiaNotification[]>([]);
  const processedRelatosRef = useRef<Set<string>>(new Set());

  useEffect(() => { vigiasRef.current = vigias; }, [vigias]);

  /* ---------- Persistência ---------- */

  const commitNotifications = useCallback((next: VigiaNotification[]) => {
    if (!ownerKey) return;
    const trimmed = next.slice(0, MAX_NOTIFICATIONS);
    notificationsRef.current = trimmed;
    setNotifications(trimmed);
    AsyncStorage.setItem(`@gryfo_vigia_notificacoes_${ownerKey}`, JSON.stringify(trimmed)).catch(e =>
      console.warn('Erro ao salvar notificações:', e)
    );
  }, [ownerKey]);

  const saveVigias = useCallback(async (next: Vigia[]) => {
    if (!ownerKey) return;
    vigiasRef.current = next;
    setVigias(next);
    try {
      await AsyncStorage.setItem(`@gryfo_vigias_${ownerKey}`, JSON.stringify(next));
    } catch (e) {
      console.warn('Erro ao salvar vigias:', e);
    }
  }, [ownerKey]);

  /* ---------- Carregamento inicial ---------- */

  useEffect(() => {
    if (!ownerKey) return;

    let mounted = true;
    setVigiasLoaded(false);
    setNotificationsLoaded(false);

    (async () => {
      try {
        const [storedVigias, storedNotifications] = await Promise.all([
          AsyncStorage.getItem(`@gryfo_vigias_${ownerKey}`),
          AsyncStorage.getItem(`@gryfo_vigia_notificacoes_${ownerKey}`),
        ]);

        if (!mounted) return;

        if (storedVigias) {
          const parsed: Vigia[] = JSON.parse(storedVigias);
          vigiasRef.current = parsed;
          setVigias(parsed);
        } else {
          vigiasRef.current = [];
          setVigias([]);
        }

        if (storedNotifications) {
          const parsed: VigiaNotification[] = JSON.parse(storedNotifications);
          notificationsRef.current = parsed;
          processedRelatosRef.current.clear();
          parsed.forEach(n => processedRelatosRef.current.add(n.relatoId));
          setNotifications(parsed);
        } else {
          notificationsRef.current = [];
          processedRelatosRef.current.clear();
          setNotifications([]);
        }
      } catch (e) {
        console.warn('Erro ao carregar vigias/notificações:', e);
      } finally {
        if (mounted) {
          setVigiasLoaded(true);
          setNotificationsLoaded(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [ownerKey]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => setAuthUid(user?.uid ?? null));
    return unsubscribe;
  }, []);

  const hasVigias = vigias.length > 0;

  // Pede permissão de notificação assim que o usuário tiver ao menos um vigia
  useEffect(() => {
    if (hasVigias) setupLocalNotifications();
  }, [hasVigias]);

  /* ---------- Monitor de relatos ---------- */

  useEffect(() => {
    if (!vigiasLoaded || !notificationsLoaded || !hasVigias || !ownerKey) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      const now = Date.now();
      const lastCheckKey = `@gryfo_vigias_last_check_${ownerKey}`;
      const storedLastCheck = await AsyncStorage.getItem(lastCheckKey);
      let lastCheck = storedLastCheck ? Number(storedLastCheck) : now;
      if (!Number.isFinite(lastCheck)) lastCheck = now;
      lastCheck = Math.max(lastCheck, now - MAX_CATCHUP_MS);
      if (!storedLastCheck) await AsyncStorage.setItem(lastCheckKey, String(lastCheck));

      // IDs que identificam relatos do próprio usuário (logado ou visitante)
      const myIds = new Set([deviceId, authUid].filter(Boolean) as string[]);

      if (cancelled) return;

      const q = query(
        collection(db, 'relatos'),
        where('createdAt', '>', Timestamp.fromMillis(lastCheck))
      );

      let isFirstSnapshot = true;

      unsubscribe = onSnapshot(q, snapshot => {
        const fresh: VigiaRelatoNotification[] = [];
        let maxCreatedAt = lastCheck;

        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') return;
          const docSnap = change.doc;
          if (docSnap.metadata.hasPendingWrites) return; // escrita local ainda não confirmada
          if (processedRelatosRef.current.has(docSnap.id)) return;

          const data: any = docSnap.data();
          const createdAtMs: number | null = data?.createdAt?.toMillis ? data.createdAt.toMillis() : null;
          if (createdAtMs === null) return; // serverTimestamp ainda não resolvido

          processedRelatosRef.current.add(docSnap.id);
          maxCreatedAt = Math.max(maxCreatedAt, createdAtMs);

          if (data.ownerId && myIds.has(data.ownerId)) return;

          const lat = Number(data.latitude);
          const lng = Number(data.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;

          // Vigias cuja área contém o relato (e que já existiam quando o relato foi criado)
          const matches = vigiasRef.current
            .filter(v => createdAtMs >= v.createdAt)
            .map(v => ({ vigia: v, distance: distanceInMeters(v.latitude, v.longitude, lat, lng) }))
            .filter(m => m.distance <= m.vigia.radius)
            .sort((a, b) => a.distance - b.distance);

          if (matches.length === 0) return;

          fresh.push({
            id: `vn_${docSnap.id}`,
            type: 'vigia_relato',
            relatoId: docSnap.id,
            vigiaIds: matches.map(m => m.vigia.id),
            vigiaNames: matches.map(m => m.vigia.name),
            crimeKey: data.crimeKey ?? null,
            texto: data.texto ?? '',
            latitude: lat,
            longitude: lng,
            distance: matches[0].distance,
            relatoCreatedAt: createdAtMs,
            createdAt: Date.now(),
            read: false,
          });
        });

        if (maxCreatedAt > lastCheck) {
          lastCheck = maxCreatedAt;
          AsyncStorage.setItem(lastCheckKey, String(maxCreatedAt)).catch(() => { });
        }

        const wasCatchUp = isFirstSnapshot;
        isFirstSnapshot = false;

        if (fresh.length === 0) return;

        fresh.sort((a, b) => b.relatoCreatedAt - a.relatoCreatedAt);
        commitNotifications([...fresh, ...notificationsRef.current]);

        // Notificação no sistema
        if (wasCatchUp && fresh.length > MAX_INDIVIDUAL_SYSTEM_NOTIFICATIONS) {
          const vigiaCount = new Set(fresh.flatMap(n => n.vigiaIds)).size;
          presentLocalNotification(
            `${fresh.length} novos relatos nas áreas dos seus vigias`,
            vigiaCount > 1
              ? `Enquanto você esteve fora, ${vigiaCount} vigias detectaram atividade. Toque para ver.`
              : `Enquanto você esteve fora, "${fresh[0].vigiaNames[0]}" detectou atividade. Toque para ver.`,
            { type: 'vigia_relato' }
          );
        } else {
          fresh.forEach(n => {
            const crime = n.crimeKey ? formatCrimeName(n.crimeKey) : 'Novo relato';
            presentLocalNotification(
              `Vigia "${n.vigiaNames[0]}" · ${crime}`,
              `${formatDistance(n.distance)} do ponto monitorado: "${truncate(n.texto, 90)}"`,
              {
                type: 'vigia_relato',
                notificationId: n.id,
                relatoId: n.relatoId,
                latitude: n.latitude,
                longitude: n.longitude,
              }
            );
          });
        }
      }, error => {
        console.error('Erro no monitor de vigias:', error);
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [vigiasLoaded, notificationsLoaded, hasVigias, ownerKey, authUid, deviceId, commitNotifications]);

  /* ---------- Monitor de Upvotes ---------- */

  useEffect(() => {
    if (!ownerKey) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      const myIds = new Set([deviceId, authUid].filter(Boolean) as string[]);
      if (myIds.size === 0) return;

      const milestonesKey = `@gryfo_upvote_milestones_${ownerKey}`;
      const stored = await AsyncStorage.getItem(milestonesKey);
      const notifiedMilestones: Record<string, number> = stored ? JSON.parse(stored) : {};

      if (cancelled) return;

      const q = query(
        collection(db, 'relatos'),
        where('ownerId', 'in', Array.from(myIds))
      );

      let isFirstSnapshot = true;

      unsubscribe = onSnapshot(q, snapshot => {
        const fresh: VigiaNotification[] = [];
        let updatedMilestones = false;

        snapshot.docChanges().forEach(change => {
          if (change.type === 'removed') return;
          const data: any = change.doc.data();
          const upvotes = data.upvotes || 0;
          if (upvotes === 0) return;

          const UPVOTE_MILESTONES = [1, 10, 20, 50, 100, 200, 500, 1000];
          let highest = 0;
          for (const m of UPVOTE_MILESTONES) {
            if (upvotes >= m) highest = m;
          }

          const currentNotified = notifiedMilestones[change.doc.id] || 0;

          if (highest > currentNotified) {
            notifiedMilestones[change.doc.id] = highest;
            updatedMilestones = true;

            const createdAtMs = data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now();
            fresh.push({
              id: `un_${change.doc.id}_${highest}`,
              type: 'upvote_milestone',
              relatoId: change.doc.id,
              milestone: highest,
              crimeKey: data.crimeKey ?? null,
              texto: data.texto ?? '',
              latitude: Number(data.latitude) || 0,
              longitude: Number(data.longitude) || 0,
              relatoCreatedAt: createdAtMs,
              createdAt: Date.now(),
              read: false,
            });
          }
        });

        if (updatedMilestones) {
          AsyncStorage.setItem(milestonesKey, JSON.stringify(notifiedMilestones)).catch(() => {});
        }

        if (fresh.length > 0) {
          fresh.sort((a, b) => b.createdAt - a.createdAt);
          commitNotifications([...fresh, ...notificationsRef.current]);

          if (!isFirstSnapshot) {
            fresh.forEach(n => {
              if (n.type === 'upvote_milestone') {
                const title = n.milestone === 1 ? 'Seu relato recebeu o primeiro incentivo!' : `Seu relato recebeu ${n.milestone} incentivos`;
                presentLocalNotification(title, 'Alguém confirmou a informação do seu relato.', { type: 'upvote_milestone' });
              }
            });
          }
        }
        isFirstSnapshot = false;
      });
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [ownerKey, deviceId, authUid, commitNotifications]);

  /* ---------- Ações sobre notificações ---------- */

  const markAsRead = useCallback((id: string) => {
    const current = notificationsRef.current;
    if (!current.some(n => n.id === id && !n.read)) return;
    commitNotifications(current.map(n => (n.id === id ? { ...n, read: true } : n)));
  }, [commitNotifications]);

  const markAllAsRead = useCallback(() => {
    const current = notificationsRef.current;
    if (!current.some(n => !n.read)) return;
    commitNotifications(current.map(n => (n.read ? n : { ...n, read: true })));
  }, [commitNotifications]);

  const removeNotification = useCallback((id: string) => {
    commitNotifications(notificationsRef.current.filter(n => n.id !== id));
  }, [commitNotifications]);

  const clearNotifications = useCallback(() => {
    commitNotifications([]);
  }, [commitNotifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const value = useMemo<VigiasContextType>(() => ({
    vigias,
    vigiasLoaded,
    saveVigias,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearNotifications,
  }), [vigias, vigiasLoaded, saveVigias, notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, clearNotifications]);

  return <VigiasContext.Provider value={value}>{children}</VigiasContext.Provider>;
}

export function useVigias() {
  const ctx = useContext(VigiasContext);
  if (!ctx) throw new Error('useVigias deve ser usado dentro de <VigiasProvider>');
  return ctx;
}
