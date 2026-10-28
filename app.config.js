// Layers build-time secrets over app.json. On EAS, GOOGLE_SERVICES_JSON is a
// secret file variable; locally the git-ignored ./google-services.json is used.
// GOOGLE_MAPS_API_KEY (Maps SDK for Android, restricted to the package + signing
// SHA-1) is an EAS secret; locally it comes from the git-ignored .env.maps.
const base = require('./app.json');

// Size (Martin, 28 Oct): R8 + resource shrinking on every release build. Test APKs set
// SR2GO_TEST_APK=1 (EAS staging profile): 64-bit ARM only, native libs compressed, so the
// download stays small on mobile data. Store AABs keep both ARM ABIs; Play sends each
// phone only its own.
const testApk = process.env.SR2GO_TEST_APK === '1';
const buildProperties = [
  'expo-build-properties',
  {
    android: {
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
      buildArchs: testApk ? ['arm64-v8a'] : ['arm64-v8a', 'armeabi-v7a'],
      useLegacyPackaging: testApk,
    },
  },
];

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
    buildProperties,
  ],
});
