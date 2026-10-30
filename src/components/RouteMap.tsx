import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

import { colors, radius } from '../theme';

export interface MapPoint {
  lat: number;
  lng: number;
  title: string;
}

/**
 * Ride details map (joint test item 8): pickup point and drop-off on a real
 * map (Maps SDK for Android). Static: no live position here.
 */
export function RouteMap({
  pickup,
  dropoff,
  line,
  height = 180,
}: {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  /** Road line from GET /api/rides/{id}/route; drawn as given. */
  line?: { latitude: number; longitude: number }[] | null;
  height?: number;
}) {
  const ref = useRef<MapView | null>(null);
  const points = [pickup, dropoff].filter((p): p is MapPoint => !!p);
  const first = points[0];
  if (!first) return null;
  const coords = [...points.map((p) => ({ latitude: p.lat, longitude: p.lng })), ...(line ?? [])];
  // Item 26: start already zoomed to fit both ends (Abuja was cut off at the edge).
  const lats = coords.map((p) => p.latitude);
  const lngs = coords.map((p) => p.longitude);
  const region = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max((Math.max(...lats) - Math.min(...lats)) * 1.6, 0.05),
    longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.6, 0.05),
  };

  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel="Route map">
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        onMapReady={() => {
          if (coords.length > 1) {
            setTimeout(() => {
              ref.current?.fitToCoordinates(coords, {
                edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
                animated: false,
              });
            }, 250);
          }
        }}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {line && line.length > 1 ? (
          <Polyline coordinates={line} strokeColor={colors.brand} strokeWidth={4} />
        ) : null}
        {pickup ? (
          <Marker
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
            title={pickup.title}
            pinColor={colors.brand}
          />
        ) : null}
        {dropoff ? (
          <Marker
            coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
            title={dropoff.title}
            pinColor={colors.navy}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.lg, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
});
