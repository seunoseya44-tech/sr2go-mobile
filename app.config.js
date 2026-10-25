// Layers build-time secrets over app.json. On EAS, GOOGLE_SERVICES_JSON is a
// secret file variable; locally the git-ignored ./google-services.json is used.
// GOOGLE_MAPS_API_KEY (Maps SDK for Android, restricted to the package + signing
// SHA-1) is an EAS secret; locally it comes from the git-ignored .env.maps.
const base = require('./app.json');

module.exports = ({ config }) => ({
  ...base.expo,
  ...config,
  android: {
    ...base.expo.android,
    ...(config.android ?? {}),
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    config: {
      ...(base.expo.android.config ?? {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' },
    },
  },
  plugins: [
    ...base.expo.plugins,
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' }],
  ],
});
