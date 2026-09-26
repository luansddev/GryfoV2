import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps';
import { useSharedMap } from '../context/SharedMapContext';

export default function SharedMapView() {
  const {
    mapRef,
    region,
    setRegion,
    activeTab,
    getMapChildren,
    handleMapPress,
    mapInteractionEnabled,
    userLocation
  } = useSharedMap();

  // Tab key mappings: 0=dados, 1=relatos, 2=locais
  const tabKey = useMemo(() => {
    switch (activeTab) {
      case 0: return 'dados';
      case 1: return 'relatos';
      case 2: return 'locais';
      default: return 'dados';
    }
  }, [activeTab]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        onPress={handleMapPress}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        scrollEnabled={mapInteractionEnabled}
        zoomEnabled={mapInteractionEnabled}
        pitchEnabled={mapInteractionEnabled}
        rotateEnabled={mapInteractionEnabled}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        {/* Marcador Customizado da Localização do Usuário */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.coords.latitude,
              longitude: userLocation.coords.longitude
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={999}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: 'rgba(37, 99, 235, 0.25)',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <View style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: '#2563eb',
                  borderWidth: 2,
                  borderColor: '#fff'
                }} />
              </View>
            </View>
          </Marker>
        )}

        {/* Render children for the currently active tab */}
        {getMapChildren(tabKey)}
      </MapView>
    </View>
  );
}
