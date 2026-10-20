// Layers build-time secrets over app.json. On EAS, GOOGLE_SERVICES_JSON is a
// secret file variable; locally the git-ignored ./google-services.json is used.
const base = require('./app.json');

module.exports = ({ config }) => ({
  ...base.expo,
  ...config,
  android: {
    ...base.expo.android,
    ...(config.android ?? {}),
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
