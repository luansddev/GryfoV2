import React, { createContext, useContext, useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import MapView, { Region, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';

interface SharedMapContextType {
  mapRef: React.RefObject<MapView | null>;
  region: Region;
  setRegion: (r: Region) => void;
  userLocation: Location.LocationObject | null;
  locationLoading: boolean;
  activeTab: number;
  setActiveTab: (tab: number) => void;

  // Marker registration — tabs push their markers here, home.tsx renders them
  registerMapChildren: (key: string, children: ReactNode) => void;
  getMapChildren: (key: string) => ReactNode;

  // Map press handler — tabs register their handlers by key
  setMapPressHandler: (key: string, handler: ((e: MapPressEvent) => void) | undefined) => void;
  handleMapPress: (e: MapPressEvent) => void;

  // Map interaction control (scroll/zoom/pitch/rotate)
  mapInteractionEnabled: boolean;
  setMapInteractionEnabled: (enabled: boolean) => void;

  // Track if we are currently creating a relato
  isCreatingRelato: boolean;
  setIsCreatingRelato: (isCreating: boolean) => void;
}

const SharedMapContext = createContext<SharedMapContextType>(null as any);

export function SharedMapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<MapView | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [region, setRegion] = useState<Region>({
    latitude: -23.5505,
    longitude: -46.6333,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapInteractionEnabled, setMapInteractionEnabled] = useState(true);
  const [isCreatingRelato, setIsCreatingRelato] = useState(false);

  /* ================= MARKER REGISTRATION ================= */
  const markersStore = useRef<{ [key: string]: ReactNode }>({});
  const [, setMarkersVersion] = useState(0);

  const registerMapChildren = useCallback((key: string, markerChildren: ReactNode) => {
    markersStore.current[key] = markerChildren;
    setMarkersVersion(v => v + 1);
  }, []);

  /* ================= MAP PRESS HANDLER ================= */
  const mapPressHandlers = useRef<{ [key: string]: (e: MapPressEvent) => void }>({});

  const setMapPressHandler = useCallback((key: string, handler: ((e: MapPressEvent) => void) | undefined) => {
    if (handler) {
      mapPressHandlers.current[key] = handler;
    } else {
      delete mapPressHandlers.current[key];
    }
  }, []);

  const handleMapPress = useCallback((e: MapPressEvent) => {
    Object.values(mapPressHandlers.current).forEach(handler => handler(e));
  }, []);

  /* ================= LOCATION INIT ================= */
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;
        if (status !== 'granted') {
          setLocationLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        if (!isMounted) return;
        setUserLocation(loc);
        const newRegion: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion);
      } catch (error) {
        console.warn('Erro ao obter localização:', error);
      } finally {
        if (isMounted) setLocationLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  return (
    <SharedMapContext.Provider value={{
      mapRef,
      region,
      setRegion,
      userLocation,
      locationLoading,
      activeTab,
      setActiveTab,
      registerMapChildren,
      getMapChildren: (key: string) => markersStore.current[key] || null,
      setMapPressHandler,
      handleMapPress,
      mapInteractionEnabled,
      setMapInteractionEnabled,
      isCreatingRelato,
      setIsCreatingRelato,
    }}>
      {children}
    </SharedMapContext.Provider>
  );
}

export function useSharedMap() {
  return useContext(SharedMapContext);
}
