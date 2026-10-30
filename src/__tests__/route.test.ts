import { parseRideRoute, routeSummary } from '../api/route';

describe('ride route', () => {
  it('reads the GeoJSON line in [lng, lat] order', () => {
    const r = parseRideRoute({
      distance_km: 302.4,
      duration_min: 290,
      source: 'osrm',
      geometry: {
        type: 'LineString',
        coordinates: [
          [4.55, 8.49],
          [7.49, 9.07],
        ],
      },
    });
    expect(r.line).toEqual([
      { latitude: 8.49, longitude: 4.55 },
      { latitude: 9.07, longitude: 7.49 },
    ]);
    expect(r.estimate).toBe(false);
    expect(routeSummary(r)).toBe('302 km · 4 h 50 min by road');
  });

  it('marks the straight-line fallback as an estimate and draws no line', () => {
    const r = parseRideRoute({
      distance_km: 250,
      duration_min: 45,
      source: 'haversine_fallback',
      geometry: null,
    });
    expect(r.line).toBeNull();
    expect(r.estimate).toBe(true);
    expect(routeSummary(r)).toBe('about 250 km · about 45 min by road');
  });
});
