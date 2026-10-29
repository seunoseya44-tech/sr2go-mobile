import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

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
  height = 180,
}: {
  pickup: MapPoint | null;
  dropoff: MapPoint | null;
  height?: number;
}) {
  const ref = useRef<MapView | null>(null);
  const points = [pickup, dropoff].filter((p): p is MapPoint => !!p);
  const first = points[0];
  if (!first) return null;
  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel="Route map">
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: first.lat,
          longitude: first.lng,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
        onMapReady={() => {
          if (coords.length > 1) {
            ref.current?.fitToCoordinates(coords, {
              edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
              animated: false,
            });
          }
        }}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
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
