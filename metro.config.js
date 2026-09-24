// Learn more https://docs.expo.dev/guides/customizing-metro/
const https = require('https');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Dev-only API proxy for the web preview.
 *
 * The API only allows CORS from https://shareride2go.com, so a browser on
 * localhost can't call it directly. In development on web the app calls
 * same-origin `/api/...` (see src/config/env.ts) and this middleware forwards
 * those requests server-side, where CORS doesn't apply. Native apps aren't
 * subject to CORS and always call the API directly; production bundles never
 * use this.
 */
const API_TARGET = new URL(process.env.EXPO_PUBLIC_API_BASE_URL || 'https://shareride2go.com');

function apiProxy(req, res, next) {
  if (!req.url || !req.url.startsWith('/api/')) return next();

  const headers = { ...req.headers, host: API_TARGET.host };
  // Present as a first-party request rather than a cross-origin one.
  delete headers.origin;
  delete headers.referer;

  const upstream = https.request(
    {
      protocol: API_TARGET.protocol,
      hostname: API_TARGET.hostname,
      port: API_TARGET.port || 443,
      method: req.method,
      path: req.url,
      headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: 'Dev proxy could not reach the API' }));
  });

  req.pipe(upstream);
}

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) =>
    apiProxy(req, res, () => middleware(req, res, next)),
};

module.exports = config;
