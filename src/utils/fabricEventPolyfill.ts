/**
 * Polyfill for React Native Fabric (New Architecture) with react-native-maps.
 *
 * In Fabric, native direct events dispatched from native view managers must be registered
 * in customDirectEventTypes. The react-native-maps library dispatches events like
 * "topUserLocationChange" on Android without declaring them in its Codegen spec.
 *
 * This polyfill registers those event names in customDirectEventTypes so that
 * ReactFabric does not throw "Unsupported top level event type" errors.
 */

const mapDirectEvents: Array<{ top: string; reg: string }> = [
  { top: 'topUserLocationChange', reg: 'onUserLocationChange' },
  { top: 'topMapReady', reg: 'onMapReady' },
  { top: 'topMapLoaded', reg: 'onMapLoaded' },
  { top: 'topKmlReady', reg: 'onKmlReady' },
  { top: 'topPoiClick', reg: 'onPoiClick' },
  { top: 'topMarkerPress', reg: 'onMarkerPress' },
  { top: 'topMarkerSelect', reg: 'onMarkerSelect' },
  { top: 'topMarkerDeselect', reg: 'onMarkerDeselect' },
  { top: 'topCalloutPress', reg: 'onCalloutPress' },
  { top: 'topMarkerDrag', reg: 'onMarkerDrag' },
  { top: 'topMarkerDragStart', reg: 'onMarkerDragStart' },
  { top: 'topMarkerDragEnd', reg: 'onMarkerDragEnd' },
  { top: 'topPanDrag', reg: 'onPanDrag' },
  { top: 'topDoublePress', reg: 'onDoublePress' },
  { top: 'topRegionChange', reg: 'onRegionChange' },
  { top: 'topRegionChangeStart', reg: 'onRegionChangeStart' },
  { top: 'topRegionChangeComplete', reg: 'onRegionChangeComplete' },
  { top: 'topIndoorBuildingFocused', reg: 'onIndoorBuildingFocused' },
  { top: 'topIndoorLevelActivated', reg: 'onIndoorLevelActivated' },
];

function registerDirectEvents(registry: any) {
  if (!registry || !registry.customDirectEventTypes) return;
  for (const evt of mapDirectEvents) {
    if (!registry.customDirectEventTypes[evt.top]) {
      registry.customDirectEventTypes[evt.top] = {
        registrationName: evt.reg,
      };
    }
  }
}

try {
  // @ts-ignore
  const reg1 = require('react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry');
  registerDirectEvents(reg1);
} catch (e) {
  // Ignore
}

try {
  // @ts-ignore
  const { ReactNativeViewConfigRegistry: reg2 } = require('react-native/Libraries/ReactPrivate/ReactNativePrivateInterface');
  registerDirectEvents(reg2);
} catch (e) {
  // Ignore
}
