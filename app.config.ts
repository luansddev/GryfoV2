import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || "Gryfo",
  slug: config.slug || "Gryfo",
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        ...config.android?.config?.googleMaps,
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
      }
    }
  }
});
