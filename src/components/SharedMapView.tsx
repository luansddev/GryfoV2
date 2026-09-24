import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
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
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        scrollEnabled={mapInteractionEnabled}
        zoomEnabled={mapInteractionEnabled}
        pitchEnabled={mapInteractionEnabled}
        rotateEnabled={mapInteractionEnabled}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        {/* Render children for the currently active tab */}
        {getMapChildren(tabKey)}
      </MapView>
    </View>
  );
}
